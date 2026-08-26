import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

import { useLibrary } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { books, clearBooks } = useLibrary();

  const totalBooks = books.length;
  const readBooks = books.filter((b) => b.status === "read").length;
  const readingBooks = books.filter((b) => b.status === "reading").length;
  const unreadBooks = books.filter((b) => b.status === "unread").length;
  const totalPages = books.reduce(
    (sum, b) => sum + (b.status === "read" ? b.pageCount : b.currentPage),
    0,
  );

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 16,
      paddingTop: Platform.OS === "web" ? 83 : insets.top + 8,
      paddingBottom: 12,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    scroll: {
      flex: 1,
    },
    content: {
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom:
        Platform.OS === "web" ? insets.bottom + 34 : insets.bottom + 20,
    },
    sectionTitle: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      marginBottom: 10,
      marginTop: 18,
    },
    statsGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
    },
    statCard: {
      flex: 1,
      minWidth: "45%",
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 26,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      lineHeight: 31,
    },
    statLabel: {
      fontSize: 12,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      marginTop: 2,
    },
    statAccent: {
      color: colors.accent,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      padding: 13,
      gap: 14,
    },
    rowDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 50,
    },
    rowLabel: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_400Regular",
      color: colors.foreground,
    },
    rowValue: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
    },
    destructiveRow: {
      flexDirection: "row",
      alignItems: "center",
      padding: 13,
      gap: 14,
    },
    destructiveLabel: {
      flex: 1,
      fontSize: 15,
      fontFamily: "Inter_500Medium",
      color: colors.destructive,
    },
  });

  const clearAll = () => {
    if (Platform.OS === "web") {
      if (
        confirm("Remove all books from your library? This cannot be undone.")
      ) {
        clearBooks();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    } else {
      Alert.alert(
        "Clear Library",
        "Remove all books from your library? This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Clear All",
            style: "destructive",
            onPress: () => {
              clearBooks();
              Haptics.notificationAsync(
                Haptics.NotificationFeedbackType.Warning,
              );
            },
          },
        ],
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Stats & Settings</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Reading Stats</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalBooks}</Text>
              <Text style={styles.statLabel}>Total Books</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, styles.statAccent]}>
                {readBooks}
              </Text>
              <Text style={styles.statLabel}>Books Read</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{readingBooks}</Text>
              <Text style={styles.statLabel}>Currently Reading</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{unreadBooks}</Text>
              <Text style={styles.statLabel}>To Read</Text>
            </View>
          </View>

          <View style={[styles.statCard, { marginTop: 10, minWidth: "100%" }]}>
            <Text style={[styles.statValue, styles.statAccent]}>
              {totalPages.toLocaleString()}
            </Text>
            <Text style={styles.statLabel}>Total Pages Read</Text>
          </View>

          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons
                name="book-outline"
                size={22}
                color={colors.mutedForeground}
              />
              <Text style={styles.rowLabel}>BookShelf</Text>
              <Text style={styles.rowValue}>v1.0</Text>
            </View>
            <View style={styles.rowDivider} />
            <View style={styles.row}>
              <Ionicons
                name="globe-outline"
                size={22}
                color={colors.mutedForeground}
              />
              <Text style={styles.rowLabel}>Book Data</Text>
              <Text style={styles.rowValue}>Google Books</Text>
            </View>
          </View>

          {totalBooks > 0 && (
            <>
              <Text style={styles.sectionTitle}>Danger Zone</Text>
              <View style={styles.card}>
                <Pressable style={styles.destructiveRow} onPress={clearAll}>
                  <Feather
                    name="trash-2"
                    size={22}
                    color={colors.destructive}
                  />
                  <Text style={styles.destructiveLabel}>Clear All Books</Text>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={colors.destructive}
                  />
                </Pressable>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
