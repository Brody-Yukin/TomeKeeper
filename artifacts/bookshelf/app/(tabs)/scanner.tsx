import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useLibrary } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";
import {
  apiUrl,
  BookInfo,
  BookLookupError,
  fetchBookByISBN,
  searchBooksByTitleAuthor,
} from "@/utils/googleBooks";

type Phase =
  | "scan"
  | "loading"
  | "found"
  | "not-found"
  | "already-added"
  | "manual"
  | "cover-loading"
  | "cover-results"
  | "cover-not-found";

interface CoverAnalysis {
  title: string;
  authors: string[];
  publisher: string;
  editionText: string;
  possibleIsbn: string;
  confidence: number;
}

const MIN_COVER_CONFIDENCE = 0.55;

function isValidIsbn(isbn: string): boolean {
  const clean = isbn.replace(/[^0-9Xx]/g, "");
  return clean.length === 10 || clean.length === 13;
}

export default function ScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addBook, hasBook } = useLibrary();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("scan");
  const [scannedISBN, setScannedISBN] = useState("");
  const [foundBook, setFoundBook] = useState<BookInfo | null>(null);
  const [manualISBN, setManualISBN] = useState("");
  const [candidates, setCandidates] = useState<BookInfo[]>([]);
  const [coverError, setCoverError] = useState("");
  const [lookupError, setLookupError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const lastScanned = useRef<string>("");
  const scanCooldown = useRef(false);

  const handleBarcode = async ({ data }: { data: string }) => {
    if (capturing || scanCooldown.current || data === lastScanned.current) return;
    lastScanned.current = data;
    scanCooldown.current = true;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await processISBN(data);
    setTimeout(() => {
      scanCooldown.current = false;
    }, 3000);
  };

  const processISBN = async (isbn: string) => {
    setScannedISBN(isbn);
    if (hasBook(isbn)) {
      setPhase("already-added");
      return;
    }
    setPhase("loading");
    try {
      const book = await fetchBookByISBN(isbn);
      if (book) {
        setFoundBook(book);
        setPhase("found");
      } else {
        setLookupError(`We couldn't find a book for ISBN: ${isbn}`);
        setPhase("not-found");
      }
    } catch (err) {
      if (err instanceof BookLookupError && err.kind === "network") {
        setLookupError(
          "Couldn't reach the server. Check your internet connection and try again.",
        );
      } else if (err instanceof BookLookupError && err.kind === "catalog") {
        setLookupError(
          "The book catalog service is having trouble right now. Please try again shortly.",
        );
      } else {
        setLookupError("Something went wrong looking up this book. Please try again.");
      }
      setPhase("not-found");
    }
  };

  const handleScanCover = async () => {
    if (!cameraRef.current || !cameraReady || capturing) return;
    setCapturing(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.6,
        base64: true,
      });
      if (!photo?.base64) {
        setCoverError(
          "We couldn't capture a photo. Please try again.",
        );
        setPhase("cover-not-found");
        return;
      }
      setPhase("cover-loading");

      let resp: Response;
      try {
        resp = await fetch(apiUrl("/api/books/identify-cover"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: photo.base64,
            mimeType: "image/jpeg",
          }),
        });
      } catch {
        setCoverError(
          "Couldn't reach the server. Check your internet connection and try again.",
        );
        setPhase("cover-not-found");
        return;
      }
      if (resp.status === 429) {
        setCoverError(
          "You're scanning too quickly. Wait a minute and try again.",
        );
        setPhase("cover-not-found");
        return;
      }
      if (resp.status === 502) {
        setCoverError(
          "The recognition service is temporarily unavailable. Please try again shortly.",
        );
        setPhase("cover-not-found");
        return;
      }
      if (!resp.ok) {
        setCoverError(
          "Something went wrong identifying the cover. Please try again.",
        );
        setPhase("cover-not-found");
        return;
      }
      const analysis: CoverAnalysis = await resp.json();

      const hasValidIsbn =
        !!analysis.possibleIsbn && isValidIsbn(analysis.possibleIsbn);

      if (analysis.confidence < MIN_COVER_CONFIDENCE && !hasValidIsbn) {
        setCoverError(
          "That doesn't look like a book cover we can recognize. Try again with the front cover filling the frame in good lighting.",
        );
        setPhase("cover-not-found");
        return;
      }

      let results: BookInfo[] = [];

      if (hasValidIsbn) {
        try {
          const book = await fetchBookByISBN(analysis.possibleIsbn);
          if (book) results = [book];
        } catch {
          // Fall through to the title/author search below.
        }
      }

      if (results.length === 0 && analysis.title) {
        results = await searchBooksByTitleAuthor({
          title: analysis.title,
          author: analysis.authors[0],
          publisher: analysis.publisher,
          editionText: analysis.editionText,
        });
      }

      if (results.length > 0) {
        setCandidates(results);
        setPhase("cover-results");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        setCoverError(
          analysis.title
            ? `We recognized "${analysis.title}" but couldn't find a matching edition. Try scanning the barcode or entering the ISBN manually.`
            : "We couldn't match that cover photo to a book. Try again with better lighting, scan the barcode, or enter the ISBN manually.",
        );
        setPhase("cover-not-found");
      }
    } catch {
      setCoverError(
        "Something went wrong identifying the cover. Please try again.",
      );
      setPhase("cover-not-found");
    } finally {
      setCapturing(false);
    }
  };

  const handleSelectCandidate = (book: BookInfo) => {
    if (hasBook(book.isbn)) {
      setScannedISBN(book.isbn);
      setPhase("already-added");
      return;
    }
    addBook(book);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/(tabs)");
    resetScan();
  };

  const handleAdd = () => {
    if (!foundBook) return;
    addBook(foundBook);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/(tabs)");
    resetScan();
  };

  // Reset to a fresh scan view whenever the user leaves this tab,
  // so returning never shows a stale "add to library" screen.
  useFocusEffect(
    useCallback(() => {
      return () => {
        lastScanned.current = "";
        setFoundBook(null);
        setManualISBN("");
        setCandidates([]);
        setCoverError("");
        setLookupError("");
        setCapturing(false);
        setPhase("scan");
      };
    }, [])
  );

  const resetScan = () => {
    lastScanned.current = "";
    setFoundBook(null);
    setManualISBN("");
    setCandidates([]);
    setCoverError("");
    setLookupError("");
    setPhase("scan");
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: "#0d0d0d",
    },
    camera: {
      flex: 1,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: "center",
      justifyContent: "center",
    },
    scanArea: {
      width: 260,
      height: 140,
      borderRadius: 16,
      borderWidth: 2.5,
      borderColor: colors.accent,
      backgroundColor: "transparent",
    },
    cornerTL: {
      position: "absolute",
      top: 0,
      left: 0,
      width: 24,
      height: 24,
      borderTopWidth: 4,
      borderLeftWidth: 4,
      borderColor: "#fff",
      borderTopLeftRadius: 8,
    },
    cornerTR: {
      position: "absolute",
      top: 0,
      right: 0,
      width: 24,
      height: 24,
      borderTopWidth: 4,
      borderRightWidth: 4,
      borderColor: "#fff",
      borderTopRightRadius: 8,
    },
    cornerBL: {
      position: "absolute",
      bottom: 0,
      left: 0,
      width: 24,
      height: 24,
      borderBottomWidth: 4,
      borderLeftWidth: 4,
      borderColor: "#fff",
      borderBottomLeftRadius: 8,
    },
    cornerBR: {
      position: "absolute",
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderBottomWidth: 4,
      borderRightWidth: 4,
      borderColor: "#fff",
      borderBottomRightRadius: 8,
    },
    scanHint: {
      marginTop: 20,
      marginHorizontal: 32,
      color: "#fff",
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      backgroundColor: "rgba(0,0,0,0.55)",
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 10,
      overflow: "hidden",
    },
    darkBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom:
        Platform.OS === "web"
          ? insets.bottom + 34
          : Platform.OS === "ios"
            ? insets.bottom + 82
            : insets.bottom + 16,
      paddingTop: 20,
      paddingHorizontal: 24,
      backgroundColor: "rgba(0,0,0,0.7)",
      gap: 12,
    },
    coverBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: colors.radius,
      backgroundColor: colors.accent,
      opacity: capturing || !cameraReady ? 0.6 : 1,
    },
    coverBtnText: {
      color: "#0d0d0d",
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
    },
    manualBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: colors.radius,
      borderWidth: 1.5,
      borderColor: "rgba(255,255,255,0.3)",
    },
    manualBtnText: {
      color: "#fff",
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    sheet: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.card,
      justifyContent: "center",
      padding: 24,
    },
    resultsSheet: {
      flex: 1,
      backgroundColor: colors.card,
      paddingHorizontal: 20,
    },
    sheetTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 6,
    },
    sheetSubtitle: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 24,
    },
    bookAuthor: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 8,
    },
    bookMeta: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 24,
    },
    candidateCard: {
      flexDirection: "row",
      gap: 14,
      padding: 14,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      marginBottom: 12,
    },
    candidateCover: {
      width: 56,
      height: 84,
      borderRadius: 6,
      backgroundColor: colors.border,
    },
    candidateInfo: {
      flex: 1,
      justifyContent: "center",
    },
    candidateTitle: {
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 2,
    },
    candidateAuthor: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginBottom: 4,
    },
    candidateMeta: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 16,
      alignItems: "center",
      marginBottom: 12,
    },
    primaryBtnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
    secondaryBtn: {
      borderRadius: colors.radius,
      padding: 14,
      alignItems: "center",
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    secondaryBtnText: {
      color: colors.foreground,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
    },
    permissionContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 32,
      backgroundColor: colors.background,
    },
    permTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginTop: 20,
      marginBottom: 10,
      textAlign: "center",
    },
    permText: {
      fontSize: 14,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      lineHeight: 22,
      marginBottom: 28,
    },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 14,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      backgroundColor: colors.background,
      marginBottom: 16,
    },
    headerTopBar: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      flexDirection: "row",
      alignItems: "center",
      paddingTop: Platform.OS === "web" ? insets.top + 16 : insets.top + 8,
      paddingHorizontal: 16,
      paddingBottom: 12,
    },
    topBarTitle: {
      flex: 1,
      textAlign: "center",
      color: "#fff",
      fontSize: 17,
      fontFamily: "Inter_600SemiBold",
    },
  });

  if (!permission) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { paddingTop: insets.top }]}>
        <Ionicons name="camera-outline" size={60} color={colors.mutedForeground} />
        <Text style={styles.permTitle}>Camera Access Needed</Text>
        <Text style={styles.permText}>
          Allow camera access to scan book barcodes or snap a photo of the
          cover. You can also enter an ISBN manually below.
        </Text>
        {permission.status === "denied" && !permission.canAskAgain && Platform.OS !== "web" ? (
          <Pressable
            style={styles.primaryBtn}
            onPress={() => {
              try {
                Linking.openSettings();
              } catch {}
            }}
          >
            <Text style={styles.primaryBtnText}>Open Settings</Text>
          </Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={requestPermission}>
            <Text style={styles.primaryBtnText}>Grant Camera Access</Text>
          </Pressable>
        )}
        <View style={{ height: 12 }} />
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => setPhase("manual")}
        >
          <Text style={styles.secondaryBtnText}>Enter ISBN Manually</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "manual") {
    return (
      <View style={[styles.sheet, { paddingTop: insets.top + 24 }]}>
        <Pressable style={{ marginBottom: 24 }} onPress={resetScan}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.sheetTitle}>Enter ISBN</Text>
        <Text style={styles.sheetSubtitle}>
          Type the ISBN number found on the back of the book
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 9780743273565"
          placeholderTextColor={colors.mutedForeground}
          value={manualISBN}
          onChangeText={setManualISBN}
          keyboardType="number-pad"
          maxLength={17}
          autoFocus
        />
        <Pressable
          style={[styles.primaryBtn, { opacity: manualISBN.length < 10 ? 0.5 : 1 }]}
          onPress={() => {
            if (manualISBN.length >= 10) processISBN(manualISBN);
          }}
          disabled={manualISBN.length < 10}
        >
          <Text style={styles.primaryBtnText}>Search</Text>
        </Pressable>
        <View style={{ height: 12 }} />
        <Pressable style={styles.secondaryBtn} onPress={resetScan}>
          <Text style={styles.secondaryBtnText}>Back to Scanner</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "loading") {
    return (
      <View style={[styles.sheet, { alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.sheetTitle, { marginTop: 20, textAlign: "center" }]}>
          Looking up book...
        </Text>
        <Text style={[styles.sheetSubtitle, { textAlign: "center" }]}>
          ISBN: {scannedISBN}
        </Text>
      </View>
    );
  }

  if (phase === "cover-loading") {
    return (
      <View style={[styles.sheet, { alignItems: "center" }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.sheetTitle, { marginTop: 20, textAlign: "center" }]}>
          Identifying cover...
        </Text>
        <Text style={[styles.sheetSubtitle, { textAlign: "center" }]}>
          Analyzing the photo and searching for matching editions
        </Text>
      </View>
    );
  }

  if (phase === "cover-results") {
    return (
      <View style={[styles.resultsSheet, { paddingTop: insets.top + 24 }]}>
        <Pressable style={{ marginBottom: 16 }} onPress={resetScan}>
          <Feather name="arrow-left" size={24} color={colors.foreground} />
        </Pressable>
        <Text style={styles.sheetTitle}>Select Your Edition</Text>
        <Text style={styles.sheetSubtitle}>
          We found {candidates.length} possible{" "}
          {candidates.length === 1 ? "match" : "matches"}. Pick the one that
          matches your book.
        </Text>
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.isbn}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.candidateCard}
              onPress={() => handleSelectCandidate(item)}
            >
              {item.coverUrl ? (
                <Image
                  source={{ uri: item.coverUrl }}
                  style={styles.candidateCover}
                  contentFit="cover"
                />
              ) : (
                <View
                  style={[
                    styles.candidateCover,
                    { alignItems: "center", justifyContent: "center" },
                  ]}
                >
                  <Ionicons
                    name="book-outline"
                    size={22}
                    color={colors.mutedForeground}
                  />
                </View>
              )}
              <View style={styles.candidateInfo}>
                <Text style={styles.candidateTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.candidateAuthor} numberOfLines={1}>
                  {item.authors.join(", ") || "Unknown Author"}
                </Text>
                <Text style={styles.candidateMeta} numberOfLines={2}>
                  {[
                    item.publisher,
                    item.publishedDate,
                    item.isbn ? `ISBN ${item.isbn}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Feather
                name="plus-circle"
                size={22}
                color={colors.accent}
                style={{ alignSelf: "center" }}
              />
            </Pressable>
          )}
        />
      </View>
    );
  }

  if (phase === "cover-not-found") {
    return (
      <View style={[styles.sheet, { paddingTop: insets.top + 24, alignItems: "center" }]}>
        <Ionicons name="image-outline" size={56} color={colors.mutedForeground} />
        <Text style={[styles.sheetTitle, { textAlign: "center", marginTop: 16 }]}>
          Couldn't Identify Cover
        </Text>
        <Text style={[styles.sheetSubtitle, { textAlign: "center" }]}>
          {coverError ||
            "We couldn't match that cover photo to a book. Try again with better lighting, scan the barcode, or enter the ISBN manually."}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={resetScan}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
        <View style={{ height: 12 }} />
        <Pressable style={styles.secondaryBtn} onPress={() => setPhase("manual")}>
          <Text style={styles.secondaryBtnText}>Enter ISBN Manually</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "found" && foundBook) {
    return (
      <View style={[styles.sheet, { paddingTop: insets.top + 24 }]}>
        <Ionicons
          name="checkmark-circle"
          size={48}
          color={colors.readColor}
          style={{ marginBottom: 16 }}
        />
        <Text style={styles.sheetTitle}>{foundBook.title}</Text>
        <Text style={styles.bookAuthor}>
          {foundBook.authors?.join(", ") || "Unknown Author"}
        </Text>
        <Text style={styles.bookMeta}>
          {[
            foundBook.publisher,
            foundBook.publishedDate?.split("-")[0],
            foundBook.pageCount > 0 ? `${foundBook.pageCount} pages` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
        {foundBook.description ? (
          <Text
            numberOfLines={4}
            style={[styles.sheetSubtitle, { marginBottom: 24 }]}
          >
            {foundBook.description}
          </Text>
        ) : null}
        <Pressable style={styles.primaryBtn} onPress={handleAdd}>
          <Text style={styles.primaryBtnText}>Add to Library</Text>
        </Pressable>
        <View style={{ height: 12 }} />
        <Pressable style={styles.secondaryBtn} onPress={resetScan}>
          <Text style={styles.secondaryBtnText}>Scan Another</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "not-found") {
    return (
      <View style={[styles.sheet, { paddingTop: insets.top + 24, alignItems: "center" }]}>
        <Ionicons name="search-outline" size={56} color={colors.mutedForeground} />
        <Text style={[styles.sheetTitle, { textAlign: "center", marginTop: 16 }]}>
          {lookupError.startsWith("We couldn't find") || !lookupError
            ? "Book Not Found"
            : "Lookup Failed"}
        </Text>
        <Text style={[styles.sheetSubtitle, { textAlign: "center" }]}>
          {lookupError || `We couldn't find a book for ISBN: ${scannedISBN}`}
        </Text>
        <Pressable style={styles.primaryBtn} onPress={resetScan}>
          <Text style={styles.primaryBtnText}>Try Again</Text>
        </Pressable>
        <View style={{ height: 12 }} />
        <Pressable style={styles.secondaryBtn} onPress={() => setPhase("manual")}>
          <Text style={styles.secondaryBtnText}>Enter Manually</Text>
        </Pressable>
      </View>
    );
  }

  if (phase === "already-added") {
    return (
      <View style={[styles.sheet, { paddingTop: insets.top + 24, alignItems: "center" }]}>
        <Ionicons name="library-outline" size={56} color={colors.accent} />
        <Text style={[styles.sheetTitle, { textAlign: "center", marginTop: 16 }]}>
          Already in Library
        </Text>
        <Text style={[styles.sheetSubtitle, { textAlign: "center" }]}>
          This book is already in your collection.
        </Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)")}>
          <Text style={styles.primaryBtnText}>Go to Library</Text>
        </Pressable>
        <View style={{ height: 12 }} />
        <Pressable style={styles.secondaryBtn} onPress={resetScan}>
          <Text style={styles.secondaryBtnText}>Scan Another</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
        onCameraReady={() => setCameraReady(true)}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8"],
        }}
        onBarcodeScanned={phase === "scan" && !capturing ? handleBarcode : undefined}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={{ position: "relative" }}>
          <View style={styles.scanArea} />
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
        <Text style={styles.scanHint}>
          Aim at the barcode, or photograph the front cover
        </Text>
      </View>
      <View style={styles.headerTopBar}>
        <Text style={styles.topBarTitle}>Scan Book</Text>
      </View>
      <View style={styles.darkBottom}>
        <Pressable
          style={styles.coverBtn}
          onPress={handleScanCover}
          disabled={capturing || !cameraReady}
        >
          {capturing ? (
            <ActivityIndicator size="small" color="#0d0d0d" />
          ) : (
            <Ionicons name="camera" size={18} color="#0d0d0d" />
          )}
          <Text style={styles.coverBtnText}>Scan Cover Instead</Text>
        </Pressable>
        <Pressable
          style={styles.manualBtn}
          onPress={() => setPhase("manual")}
        >
          <Feather name="edit-2" size={16} color="#fff" />
          <Text style={styles.manualBtnText}>Enter ISBN Manually</Text>
        </Pressable>
      </View>
    </View>
  );
}
