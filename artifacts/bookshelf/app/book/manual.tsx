import { Feather, Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import {
  isValidIsbn,
  normalizeIsbn,
  useLibrary,
} from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

const paramValue = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export default function ManualBookScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    isbn?: string;
    title?: string;
    authors?: string;
    publisher?: string;
  }>();
  const { addBook, hasBook } = useLibrary();
  const [title, setTitle] = useState(() => paramValue(params.title));
  const [authors, setAuthors] = useState(() => paramValue(params.authors));
  const [isbn, setIsbn] = useState(() => paramValue(params.isbn));
  const [publisher, setPublisher] = useState(() =>
    paramValue(params.publisher),
  );
  const [publishedDate, setPublishedDate] = useState("");
  const [pageCount, setPageCount] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [error, setError] = useState("");

  const saveBook = () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setError("Enter a title to save this book.");
      return;
    }

    const hasIsbn = isbn.trim().length > 0;
    const normalizedIsbn = hasIsbn ? normalizeIsbn(isbn) : "";
    if (hasIsbn && !isValidIsbn(normalizedIsbn)) {
      setError("Enter a valid ISBN-10 or ISBN-13 checksum.");
      return;
    }
    if (normalizedIsbn && hasBook(normalizedIsbn)) {
      setError("This ISBN is already in your library.");
      return;
    }

    const pageCountValue = pageCount.trim();
    const parsedPageCount = Number(pageCountValue);
    if (
      pageCountValue &&
      (!/^\d+$/.test(pageCountValue) ||
        !Number.isSafeInteger(parsedPageCount) ||
        parsedPageCount < 0)
    ) {
      setError("Page count must be a non-negative whole number.");
      return;
    }

    const result = addBook({
      isbn: normalizedIsbn || "",
      title: cleanTitle,
      authors: authors
        .split(",")
        .map((author) => author.trim())
        .filter(Boolean),
      description: "",
      pageCount: pageCountValue ? parsedPageCount : 0,
      coverUrl: coverUrl.trim(),
      publisher: publisher.trim(),
      publishedDate: publishedDate.trim(),
      categories: [],
      language: "en",
    });
    if (!result.added) {
      setError(
        result.reason === "duplicate"
          ? "This ISBN is already in your library."
          : "Your library is still loading. Please try again in a moment.",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.replace("/(tabs)");
  };

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.card },
    content: {
      paddingHorizontal: 20,
      paddingTop:
        Platform.OS === "web" ? Math.max(insets.top, 67) + 16 : insets.top + 16,
      paddingBottom:
        (Platform.OS === "web" ? Math.max(insets.bottom, 34) : insets.bottom) +
        28,
    },
    header: { flexDirection: "row", alignItems: "center", marginBottom: 22 },
    backButton: { paddingVertical: 8, paddingRight: 16 },
    heading: {
      flex: 1,
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    subtitle: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 21,
      marginBottom: 22,
    },
    label: {
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      marginBottom: 7,
    },
    optional: { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
    input: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: colors.radius,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      backgroundColor: colors.background,
      marginBottom: 16,
    },
    error: {
      color: colors.destructive,
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 20,
      marginBottom: 16,
    },
    saveButton: {
      flexDirection: "row",
      justifyContent: "center",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      paddingVertical: 16,
      marginTop: 4,
    },
    saveText: {
      color: colors.primaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 16,
    },
  });

  return (
    <View style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={styles.content}
        bottomOffset={68}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text style={styles.heading}>Add Book</Text>
        </View>
        <Text style={styles.subtitle}>
          Add the details you know. Only the title is required.
        </Text>

        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Book title"
          placeholderTextColor={colors.mutedForeground}
          autoFocus
        />
        <Text style={styles.label}>
          Authors <Text style={styles.optional}>(comma-separated)</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={authors}
          onChangeText={setAuthors}
          placeholder="Author One, Author Two"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={styles.label}>
          ISBN-10 or ISBN-13 <Text style={styles.optional}>(optional)</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={isbn}
          onChangeText={setIsbn}
          placeholder="9780743273565"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="characters"
        />
        <Text style={styles.label}>Publisher</Text>
        <TextInput
          style={styles.input}
          value={publisher}
          onChangeText={setPublisher}
          placeholder="Publisher"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={styles.label}>Publication Date</Text>
        <TextInput
          style={styles.input}
          value={publishedDate}
          onChangeText={setPublishedDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.mutedForeground}
        />
        <Text style={styles.label}>Page Count</Text>
        <TextInput
          style={styles.input}
          value={pageCount}
          onChangeText={setPageCount}
          placeholder="0"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
        />
        <Text style={styles.label}>Cover URL</Text>
        <TextInput
          style={styles.input}
          value={coverUrl}
          onChangeText={setCoverUrl}
          placeholder="https://…"
          placeholderTextColor={colors.mutedForeground}
          autoCapitalize="none"
          keyboardType="url"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={styles.saveButton} onPress={saveBook}>
          <Ionicons
            name="add-circle-outline"
            size={20}
            color={colors.primaryForeground}
          />
          <Text style={styles.saveText}>Save to Library</Text>
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}
