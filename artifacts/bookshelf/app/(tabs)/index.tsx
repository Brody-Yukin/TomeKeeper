import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import BookCard from "@/components/BookCard";
import BrandMark from "@/components/BrandMark";
import FilterBar from "@/components/FilterBar";
import {
  Book,
  FilterOption,
  GroupOption,
  SortOption,
  useLibrary,
} from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

const STATUS_ORDER: Record<string, number> = { reading: 0, unread: 1, read: 2 };
const STATUS_LABELS: Record<string, string> = {
  reading: "Currently Reading",
  unread: "To Read",
  read: "Finished",
};

function sortBooks(books: Book[], sortBy: SortOption): Book[] {
  return [...books].sort((a, b) => {
    switch (sortBy) {
      case "title":
        return a.title.localeCompare(b.title);
      case "author":
        return (a.authors[0] || "").localeCompare(b.authors[0] || "");
      case "pageCount":
        return b.pageCount - a.pageCount;
      case "dateAdded":
      default:
        return b.dateAdded - a.dateAdded;
    }
  });
}

function filterBooks(books: Book[], filter: FilterOption): Book[] {
  if (filter === "all") return books;
  return books.filter((b) => b.status === filter);
}

type ListItem =
  | { type: "header"; key: string; label: string }
  | { type: "book"; key: string; book: Book };

function buildGroupedList(books: Book[], groupBy: GroupOption): ListItem[] {
  if (groupBy === "none") {
    return books.map((b) => ({ type: "book", key: b.id, book: b }));
  }

  if (groupBy === "status") {
    const grouped: Record<string, Book[]> = { reading: [], unread: [], read: [] };
    books.forEach((b) => {
      if (grouped[b.status]) grouped[b.status].push(b);
    });
    const items: ListItem[] = [];
    Object.entries(grouped)
      .sort((a, b) => STATUS_ORDER[a[0]] - STATUS_ORDER[b[0]])
      .forEach(([status, group]) => {
        if (group.length > 0) {
          items.push({
            type: "header",
            key: `header-${status}`,
            label: STATUS_LABELS[status] || status,
          });
          group.forEach((b) =>
            items.push({ type: "book", key: b.id, book: b })
          );
        }
      });
    return items;
  }

  if (groupBy === "category") {
    const grouped: Record<string, Book[]> = { "Uncategorized": [] };
    books.forEach((b) => {
      const cat = b.categories?.[0] || "Uncategorized";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(b);
    });
    const items: ListItem[] = [];
    Object.entries(grouped)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([cat, group]) => {
        if (group.length > 0) {
          items.push({ type: "header", key: `header-${cat}`, label: cat });
          group.forEach((b) =>
            items.push({ type: "book", key: b.id, book: b })
          );
        }
      });
    return items;
  }

  return books.map((b) => ({ type: "book", key: b.id, book: b }));
}

export default function LibraryScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { books, filterBy, sortBy, groupBy } = useLibrary();
  const [showFilters, setShowFilters] = useState(false);

  const listData = useMemo(() => {
    const filtered = filterBooks(books, filterBy);
    const sorted = sortBooks(filtered, sortBy);
    return buildGroupedList(sorted, groupBy);
  }, [books, filterBy, sortBy, groupBy]);

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
    brandRow: {
      marginBottom: 14,
    },
    libraryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    headerTitle: {
      fontSize: 22,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
    },
    headerSubtitle: {
      fontSize: 12,
      fontFamily: "Inter_600SemiBold",
      color: colors.accentForeground,
      backgroundColor: colors.accent,
      paddingHorizontal: 9,
      paddingVertical: 3,
      borderRadius: 12,
      overflow: "hidden",
    },
    headerRight: {
      flexDirection: "row",
      gap: 12,
      alignItems: "center",
    },
    iconBtn: {
      padding: 6,
    },
    emptyContainer: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 40,
      paddingTop: 80,
    },
    emptyIcon: {
      marginBottom: 16,
      opacity: 0.3,
    },
    emptyTitle: {
      fontSize: 20,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      marginBottom: 8,
      textAlign: "center",
    },
    emptyText: {
      fontSize: 14,
      fontFamily: "Inter_400Regular",
      color: colors.mutedForeground,
      textAlign: "center",
      lineHeight: 20,
    },
    scanBtn: {
      marginTop: 24,
      backgroundColor: colors.accent,
      borderRadius: colors.radius,
      paddingHorizontal: 20,
      paddingVertical: 12,
    },
    scanBtnText: {
      color: colors.accentForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    groupHeader: {
      fontSize: 13,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
      paddingHorizontal: 16,
      paddingTop: 16,
      paddingBottom: 8,
    },
    listContent: {
      paddingHorizontal: 16,
      paddingBottom: Platform.OS === "web" ? insets.bottom + 34 : 100,
    },
    count: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 10,
    },
  });

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "header") {
      return <Text style={styles.groupHeader}>{item.label}</Text>;
    }
    return <BookCard book={item.book} />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.brandRow}>
          <BrandMark compact />
        </View>
        <View style={styles.libraryRow}>
          <View>
            <Text style={styles.headerTitle}>My Library</Text>
            <Text style={styles.headerSubtitle}>{books.length} books</Text>
          </View>
          <View style={styles.headerRight}>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                setShowFilters((v) => !v);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather
                name="sliders"
                size={21}
                color={showFilters ? colors.accent : colors.foreground}
              />
            </Pressable>
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                router.push("/(tabs)/scanner");
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Feather name="plus" size={25} color={colors.foreground} />
            </Pressable>
          </View>
        </View>
      </View>

      {showFilters && <FilterBar />}

      {books.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather
            name="book-open"
            size={64}
            color={colors.foreground}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>Your library is empty</Text>
          <Text style={styles.emptyText}>
            Scan a book's ISBN barcode to add it to your personal library
          </Text>
          <Pressable
            style={styles.scanBtn}
            onPress={() => router.push("/(tabs)/scanner")}
          >
            <Text style={styles.scanBtnText}>Scan a Book</Text>
          </Pressable>
        </View>
      ) : listData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather
            name="filter"
            size={48}
            color={colors.foreground}
            style={styles.emptyIcon}
          />
          <Text style={styles.emptyTitle}>No books match</Text>
          <Text style={styles.emptyText}>Try changing the filter</Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={showFilters ? undefined : null}
        />
      )}
    </View>
  );
}
