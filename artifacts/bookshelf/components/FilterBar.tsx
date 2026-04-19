import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { FilterOption, GroupOption, SortOption, useLibrary } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

const FILTERS: { key: FilterOption; label: string }[] = [
  { key: "all", label: "All" },
  { key: "reading", label: "Reading" },
  { key: "read", label: "Read" },
  { key: "unread", label: "Unread" },
];

const SORTS: { key: SortOption; label: string }[] = [
  { key: "dateAdded", label: "Date Added" },
  { key: "title", label: "Title" },
  { key: "author", label: "Author" },
  { key: "pageCount", label: "Pages" },
];

const GROUPS: { key: GroupOption; label: string }[] = [
  { key: "none", label: "No Group" },
  { key: "status", label: "By Status" },
  { key: "category", label: "By Category" },
];

export default function FilterBar() {
  const colors = useColors();
  const { filterBy, setFilterBy, sortBy, setSortBy, groupBy, setGroupBy } =
    useLibrary();

  const styles = StyleSheet.create({
    container: {
      paddingBottom: 8,
    },
    sectionLabel: {
      fontSize: 11,
      fontFamily: "Inter_600SemiBold",
      color: colors.mutedForeground,
      letterSpacing: 0.8,
      textTransform: "uppercase",
      paddingHorizontal: 16,
      marginBottom: 6,
      marginTop: 10,
    },
    row: {
      flexDirection: "row",
      paddingHorizontal: 12,
      gap: 6,
    },
    chip: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
      backgroundColor: colors.muted,
    },
    chipActive: {
      backgroundColor: colors.primary,
    },
    chipText: {
      fontSize: 13,
      fontFamily: "Inter_500Medium",
      color: colors.mutedForeground,
    },
    chipTextActive: {
      color: colors.primaryForeground,
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: 10,
    },
  });

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Filter</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.key}
            style={[styles.chip, filterBy === f.key && styles.chipActive]}
            onPress={() => setFilterBy(f.key)}
          >
            <Text
              style={[
                styles.chipText,
                filterBy === f.key && styles.chipTextActive,
              ]}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Sort</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {SORTS.map((s) => (
          <Pressable
            key={s.key}
            style={[styles.chip, sortBy === s.key && styles.chipActive]}
            onPress={() => setSortBy(s.key)}
          >
            <Text
              style={[
                styles.chipText,
                sortBy === s.key && styles.chipTextActive,
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <Text style={styles.sectionLabel}>Group</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {GROUPS.map((g) => (
          <Pressable
            key={g.key}
            style={[styles.chip, groupBy === g.key && styles.chipActive]}
            onPress={() => setGroupBy(g.key)}
          >
            <Text
              style={[
                styles.chipText,
                groupBy === g.key && styles.chipTextActive,
              ]}
            >
              {g.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.divider} />
    </View>
  );
}
