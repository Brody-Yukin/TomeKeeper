import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import PageProgressSheet from "@/components/PageProgressSheet";
import { ReadingStatus, useLibrary } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

const STATUS_OPTIONS: { key: ReadingStatus; label: string; icon: string }[] = [
  { key: "unread", label: "To Read", icon: "bookmark-outline" },
  { key: "reading", label: "Reading", icon: "book-outline" },
  { key: "read", label: "Finished", icon: "checkmark-circle-outline" },
];

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { books, updateStatus, updateCurrentPage, updateRating, removeBook } =
    useLibrary();
  const [pageSheetVisible, setPageSheetVisible] = useState(false);

  const book = books.find((b) => b.id === id);

  if (!book) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Book not found</Text>
      </View>
    );
  }

  const progress = book.pageCount > 0 ? book.currentPage / book.pageCount : 0;

  const handleDelete = () => {
    if (Platform.OS === "web") {
      if (confirm(`Remove "${book.title}" from your library?`)) {
        removeBook(book.id);
        router.back();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      Alert.alert(
        "Remove Book",
        `Remove "${book.title}" from your library?`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: () => {
              removeBook(book.id);
              router.back();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            },
          },
        ]
      );
    }
  };

  const statusColor =
    book.status === "read"
      ? colors.readColor
      : book.status === "reading"
      ? colors.readingColor
      : colors.unreadColor;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    navHeader: {
      flexDirection: "row",
      alignItems: "center",
      paddingTop: Platform.OS === "web" ? 12 : insets.top + 8,
      paddingBottom: 8,
      paddingHorizontal: 8,
      backgroundColor: colors.card,
      gap: 4,
    },
    backBtn: {
      flexDirection: "row",
      alignItems: "center",
      padding: 8,
    },
    navTitle: {
      flex: 1,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginRight: 40,
      textAlign: "center",
    },
    heroSection: {
      alignItems: "center",
      paddingTop: 16,
      paddingBottom: 24,
      paddingHorizontal: 20,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    cover: {
      width: 120,
      height: 180,
      borderRadius: 8,
      backgroundColor: colors.muted,
      marginBottom: 16,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 4,
    },
    title: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 6,
      lineHeight: 28,
    },
    author: {
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
    },
    content: {
      padding: 20,
      paddingBottom: Platform.OS === "web" ? insets.bottom + 34 : insets.bottom + 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 24,
    },
    statusRow: {
      flexDirection: "row",
      gap: 8,
    },
    statusChip: {
      flex: 1,
      padding: 12,
      borderRadius: colors.radius,
      alignItems: "center",
      backgroundColor: colors.muted,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    statusChipActive: {
      backgroundColor: colors.primary + "14",
      borderColor: colors.primary,
    },
    statusChipLabel: {
      fontSize: 12,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      marginTop: 4,
    },
    statusChipLabelActive: {
      color: colors.primary,
    },
    progressSection: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    progressHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10,
    },
    progressLabel: {
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    progressEdit: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    progressEditText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.accent,
    },
    progressBar: {
      height: 8,
      backgroundColor: colors.muted,
      borderRadius: 4,
      overflow: "hidden",
      marginBottom: 8,
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.accent,
      borderRadius: 4,
    },
    progressNumbers: {
      flexDirection: "row",
      justifyContent: "space-between",
    },
    progressNum: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    metaCard: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    metaRow: {
      flexDirection: "row",
      paddingHorizontal: 16,
      paddingVertical: 12,
      alignItems: "center",
      gap: 12,
    },
    metaDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 44,
    },
    metaLabel: {
      fontSize: 13,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      width: 90,
    },
    metaValue: {
      flex: 1,
      fontSize: 14,
      fontFamily: "Inter_500Medium",
      color: colors.foreground,
    },
    description: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
      lineHeight: 22,
    },
    ratingRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    starBtn: {
      padding: 4,
    },
    deleteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 24,
      padding: 14,
      borderRadius: colors.radius,
      borderWidth: 1.5,
      borderColor: colors.destructive + "40",
    },
    deleteBtnText: {
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.destructive,
    },
  });

  const metaItems = [
    { label: "Pages", value: book.pageCount > 0 ? `${book.pageCount}` : "N/A", icon: "document-text-outline" },
    { label: "Publisher", value: book.publisher || "N/A", icon: "business-outline" },
    { label: "Published", value: book.publishedDate || "N/A", icon: "calendar-outline" },
    { label: "Language", value: (book.language || "N/A").toUpperCase(), icon: "language-outline" },
    { label: "ISBN", value: book.isbn || "N/A", icon: "barcode-outline" },
    ...(book.categories?.length > 0
      ? [{ label: "Category", value: book.categories[0], icon: "pricetag-outline" }]
      : []),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navHeader}>
        <Pressable style={styles.backBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="chevron-back" size={26} color={colors.accent} />
        </Pressable>
        <Text style={styles.navTitle} numberOfLines={1}>
          {book.title}
        </Text>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          {book.coverUrl ? (
            <Image
              source={{ uri: book.coverUrl }}
              style={styles.cover}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.cover, { alignItems: "center", justifyContent: "center" }]}>
              <Ionicons name="book-outline" size={40} color={colors.mutedForeground} />
            </View>
          )}
          <Text style={styles.title}>{book.title}</Text>
          {book.authors?.length > 0 && (
            <Text style={styles.author}>{book.authors.join(", ")}</Text>
          )}
        </View>

        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Reading Status</Text>
          <View style={styles.statusRow}>
            {STATUS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.key}
                style={[
                  styles.statusChip,
                  book.status === opt.key && styles.statusChipActive,
                ]}
                onPress={() => {
                  updateStatus(book.id, opt.key);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Ionicons
                  name={opt.icon as any}
                  size={22}
                  color={book.status === opt.key ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.statusChipLabel,
                    book.status === opt.key && styles.statusChipLabelActive,
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {book.status === "reading" && book.pageCount > 0 && (
            <>
              <Text style={styles.sectionTitle}>Progress</Text>
              <View style={styles.progressSection}>
                <View style={styles.progressHeader}>
                  <Text style={styles.progressLabel}>
                    {Math.round(progress * 100)}% complete
                  </Text>
                  <Pressable
                    style={styles.progressEdit}
                    onPress={() => setPageSheetVisible(true)}
                  >
                    <Feather name="edit-2" size={14} color={colors.accent} />
                    <Text style={styles.progressEditText}>Update</Text>
                  </Pressable>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[
                      styles.progressFill,
                      { width: `${Math.round(progress * 100)}%` },
                    ]}
                  />
                </View>
                <View style={styles.progressNumbers}>
                  <Text style={styles.progressNum}>Page {book.currentPage}</Text>
                  <Text style={styles.progressNum}>{book.pageCount} total</Text>
                </View>
              </View>
            </>
          )}

          {book.status === "read" && (
            <>
              <Text style={styles.sectionTitle}>Your Rating</Text>
              <View style={styles.ratingRow}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Pressable
                    key={star}
                    style={styles.starBtn}
                    onPress={() => {
                      updateRating(book.id, star);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                  >
                    <Ionicons
                      name={star <= (book.rating ?? 0) ? "star" : "star-outline"}
                      size={30}
                      color={star <= (book.rating ?? 0) ? colors.accent : colors.border}
                    />
                  </Pressable>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionTitle}>Book Info</Text>
          <View style={styles.metaCard}>
            {metaItems.map((item, index) => (
              <View key={item.label}>
                <View style={styles.metaRow}>
                  <Ionicons name={item.icon as any} size={20} color={colors.mutedForeground} />
                  <Text style={styles.metaLabel}>{item.label}</Text>
                  <Text style={styles.metaValue} numberOfLines={2}>{item.value}</Text>
                </View>
                {index < metaItems.length - 1 && <View style={styles.metaDivider} />}
              </View>
            ))}
          </View>

          {book.description ? (
            <>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.description}>{book.description}</Text>
            </>
          ) : null}

          <Pressable style={styles.deleteBtn} onPress={handleDelete}>
            <Feather name="trash-2" size={18} color={colors.destructive} />
            <Text style={styles.deleteBtnText}>Remove from Library</Text>
          </Pressable>
        </View>
      </ScrollView>

      <PageProgressSheet
        visible={pageSheetVisible}
        currentPage={book.currentPage}
        pageCount={book.pageCount}
        onSave={(page) => {
          updateCurrentPage(book.id, page);
          setPageSheetVisible(false);
        }}
        onClose={() => setPageSheetVisible(false)}
      />
    </View>
  );
}
