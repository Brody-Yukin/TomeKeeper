import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  currentPage: number;
  pageCount: number;
  onSave: (page: number) => void;
  onClose: () => void;
}

export default function PageProgressSheet({
  visible,
  currentPage,
  pageCount,
  onSave,
  onClose,
}: Props) {
  const colors = useColors();
  const [value, setValue] = useState(currentPage.toString());

  useEffect(() => {
    setValue(currentPage.toString());
  }, [currentPage, visible]);

  const handleSave = () => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= pageCount) {
      onSave(parsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const progress = pageCount > 0 ? Math.min(parseInt(value) / pageCount, 1) : 0;
  const progressPercent = isNaN(progress) ? 0 : Math.round(progress * 100);

  const styles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.4)",
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      paddingBottom: Platform.OS === "ios" ? 40 : 24,
    },
    handle: {
      width: 36,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: 2,
      alignSelf: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "700",
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      marginBottom: 4,
    },
    subtitle: {
      fontSize: 13,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      marginBottom: 20,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginBottom: 16,
    },
    input: {
      flex: 1,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: colors.radius,
      padding: 14,
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
      backgroundColor: colors.background,
      textAlign: "center",
    },
    of: {
      fontSize: 15,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
    },
    pageCount: {
      fontSize: 18,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    progressBar: {
      height: 6,
      backgroundColor: colors.muted,
      borderRadius: 3,
      overflow: "hidden",
      marginBottom: 8,
    },
    progressFill: {
      height: "100%",
      backgroundColor: colors.accent,
      borderRadius: 3,
    },
    progressLabel: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      textAlign: "center",
      marginBottom: 20,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      borderRadius: colors.radius,
      padding: 16,
      alignItems: "center",
    },
    saveBtnText: {
      color: colors.primaryForeground,
      fontSize: 16,
      fontFamily: "Inter_600SemiBold",
    },
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
              <View style={styles.sheet}>
                <View style={styles.handle} />
                <Text style={styles.title}>Update Progress</Text>
                <Text style={styles.subtitle}>
                  What page are you on?
                </Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    value={value}
                    onChangeText={setValue}
                    keyboardType="number-pad"
                    selectTextOnFocus
                    maxLength={5}
                  />
                  <Text style={styles.of}>of</Text>
                  <Text style={styles.pageCount}>{pageCount}</Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={[styles.progressFill, { width: `${progressPercent}%` }]}
                  />
                </View>
                <Text style={styles.progressLabel}>{progressPercent}% complete</Text>
                <Pressable style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save Progress</Text>
                </Pressable>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
