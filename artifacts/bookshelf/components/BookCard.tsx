import { Feather, Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { Book } from "@/context/LibraryContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  book: Book;
}

const STATUS_LABELS = {
  read: "Read",
  reading: "Reading",
  unread: "Unread",
};

export default function BookCard({ book }: Props) {
  const colors = useColors();
  const router = useRouter();
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    router.push(`/book/${book.id}`);
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15 });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15 });
  };

  const progress =
    book.pageCount > 0 ? book.currentPage / book.pageCount : 0;

  const statusColor =
    book.status === "read"
      ? colors.readColor
      : book.status === "reading"
      ? colors.readingColor
      : colors.unreadColor;

  const styles = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      flexDirection: "row",
      alignItems: "flex-start",
      padding: 12,
      marginBottom: 10,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 2,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cover: {
      width: 56,
      height: 84,
      borderRadius: 6,
      backgroundColor: colors.muted,
    },
    info: {
      flex: 1,
      marginLeft: 12,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      lineHeight: 20,
      marginBottom: 2,
    },
    author: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 6,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    statusDot: {
      width: 7,
      height: 7,
      borderRadius: 3.5,
      backgroundColor: statusColor,
    },
    statusLabel: {
      fontSize: 12,
      color: statusColor,
      fontFamily: "Inter_500Medium",
    },
    progressBar: {
      height: 3,
      backgroundColor: colors.muted,
      borderRadius: 2,
      marginTop: 8,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      width: `${Math.round(progress * 100)}%`,
      backgroundColor: colors.accent,
      borderRadius: 2,
    },
    pageInfo: {
      fontSize: 11,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginTop: 3,
    },
    chevron: {
      alignSelf: "center",
      marginLeft: 4,
    },
  });

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
      >
        {book.coverUrl ? (
          <Image
            source={{ uri: book.coverUrl }}
            style={styles.cover}
            contentFit="cover"
          />
        ) : (
          <View
            style={[
              styles.cover,
              {
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.muted,
              },
            ]}
          >
            <Ionicons name="book-outline" size={24} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.title} numberOfLines={2}>
            {book.title}
          </Text>
          <Text style={styles.author} numberOfLines={1}>
            {book.authors?.join(", ") || "Unknown Author"}
          </Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusLabel}>{STATUS_LABELS[book.status]}</Text>
          </View>
          {book.status === "reading" && book.pageCount > 0 && (
            <>
              <View style={styles.progressBar}>
                <View style={styles.progressFill} />
              </View>
              <Text style={styles.pageInfo}>
                {book.currentPage} / {book.pageCount} pages
              </Text>
            </>
          )}
        </View>
        <View style={styles.chevron}>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
    </Animated.View>
  );
}
