import { Feather, Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import { fetchBookByISBN } from "@/utils/googleBooks";

type Phase = "scan" | "loading" | "found" | "not-found" | "already-added" | "manual";

export default function ScannerScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { addBook, hasBook } = useLibrary();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>("scan");
  const [scannedISBN, setScannedISBN] = useState("");
  const [foundBook, setFoundBook] = useState<any>(null);
  const [manualISBN, setManualISBN] = useState("");
  const lastScanned = useRef<string>("");
  const scanCooldown = useRef(false);

  const handleBarcode = async ({ data }: { data: string }) => {
    if (scanCooldown.current || data === lastScanned.current) return;
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
        setPhase("not-found");
      }
    } catch {
      setPhase("not-found");
    }
  };

  const handleAdd = () => {
    if (!foundBook) return;
    addBook(foundBook);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.push("/(tabs)/");
  };

  const resetScan = () => {
    lastScanned.current = "";
    setFoundBook(null);
    setManualISBN("");
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
      color: "#fff",
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      opacity: 0.8,
    },
    darkBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      paddingBottom: Platform.OS === "web" ? insets.bottom + 34 : insets.bottom + 16,
      paddingTop: 20,
      paddingHorizontal: 24,
      backgroundColor: "rgba(0,0,0,0.7)",
    },
    manualBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
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
    bookTitle: {
      fontSize: 20,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 4,
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
          Allow camera access to scan book barcodes. You can also enter an ISBN
          manually below.
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
          Book Not Found
        </Text>
        <Text style={[styles.sheetSubtitle, { textAlign: "center" }]}>
          We couldn't find a book for ISBN: {scannedISBN}
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
        <Pressable style={styles.primaryBtn} onPress={() => router.push("/(tabs)/")}>
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
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128"] }}
        onBarcodeScanned={handleBarcode}
      />
      <View style={styles.overlay} pointerEvents="none">
        <View style={{ position: "relative" }}>
          <View style={styles.scanArea} />
          <View style={styles.cornerTL} />
          <View style={styles.cornerTR} />
          <View style={styles.cornerBL} />
          <View style={styles.cornerBR} />
        </View>
        <Text style={styles.scanHint}>Point camera at barcode on book's back cover</Text>
      </View>
      <View style={styles.headerTopBar}>
        <Text style={styles.topBarTitle}>Scan Book</Text>
      </View>
      <View style={styles.darkBottom}>
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
