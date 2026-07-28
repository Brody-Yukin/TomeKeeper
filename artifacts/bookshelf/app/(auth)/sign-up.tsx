import { Ionicons } from "@expo/vector-icons";
import { useAuth, useSignUp, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { Link, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { createAuthStyles } from "@/components/auth/authStyles";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signUp, errors, fetchStatus } = useSignUp();
  const { isSignedIn } = useAuth();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [oauthError, setOauthError] = useState("");

  const styles = createAuthStyles(colors, insets.top);
  const busy = fetchStatus === "fetching";

  const navigateHome = ({ session, decorateUrl }: any) => {
    if (session?.currentTask) return;
    const url = decorateUrl("/");
    if (typeof url === "string" && url.startsWith("http")) {
      if (Platform.OS === "web") window.location.href = url;
    } else {
      router.push(url as Href);
    }
  };

  const handleSubmit = async () => {
    const { error } = await signUp.password({ emailAddress, password });
    if (!error) await signUp.verifications.sendEmailCode();
  };

  const handleVerify = async () => {
    await signUp.verifications.verifyEmailCode({ code });
    if (signUp.status === "complete") {
      await signUp.finalize({ navigate: navigateHome });
    }
  };

  const handleGoogle = useCallback(async () => {
    setOauthError("");
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId) {
        await setActive!({
          session: createdSessionId,
          navigate: async (args) => navigateHome(args),
        });
      }
    } catch {
      setOauthError("Google sign-up didn't finish. Please try again.");
    }
  }, [startSSOFlow]);

  if (signUp.status === "complete" || isSignedIn) {
    return null;
  }

  if (
    signUp.status === "missing_requirements" &&
    signUp.unverifiedFields.includes("email_address") &&
    signUp.missingFields.length === 0
  ) {
    return (
      <View style={styles.container}>
        <View style={styles.logoRow}>
          <Ionicons name="mail-unread-outline" size={44} color={colors.accent} />
        </View>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification code to {emailAddress}
        </Text>
        <Text style={styles.label}>Verification code</Text>
        <TextInput
          style={styles.input}
          value={code}
          placeholder="6-digit code"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="number-pad"
          onChangeText={setCode}
        />
        {errors.fields.code && (
          <Text style={styles.error}>{errors.fields.code.message}</Text>
        )}
        <Pressable
          style={[styles.primaryBtn, busy && styles.primaryBtnDisabled]}
          onPress={handleVerify}
          disabled={busy}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? "Verifying…" : "Verify"}
          </Text>
        </Pressable>
        <Pressable
          style={styles.secondaryBtn}
          onPress={() => signUp.verifications.sendEmailCode()}
        >
          <Text style={styles.secondaryBtnText}>Send a new code</Text>
        </Pressable>
      </View>
    );
  }

  const generalError = (errors.raw?.[0] as { message?: string } | undefined)
    ?.message;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoRow}>
          <Ionicons name="library" size={44} color={colors.accent} />
          <Text style={styles.appName}>BookShelf</Text>
        </View>

        <Text style={styles.title}>Create your account</Text>
        <Text style={styles.subtitle}>Start building your library</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          value={emailAddress}
          placeholder="you@example.com"
          placeholderTextColor={colors.mutedForeground}
          onChangeText={setEmailAddress}
        />
        {errors.fields.emailAddress && (
          <Text style={styles.error}>{errors.fields.emailAddress.message}</Text>
        )}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          placeholder="At least 8 characters"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          onChangeText={setPassword}
        />
        {errors.fields.password && (
          <Text style={styles.error}>{errors.fields.password.message}</Text>
        )}
        {!errors.fields.emailAddress && !errors.fields.password && generalError ? (
          <Text style={styles.error}>{generalError}</Text>
        ) : null}
        {oauthError ? <Text style={styles.error}>{oauthError}</Text> : null}

        <Pressable
          style={[
            styles.primaryBtn,
            (!emailAddress || !password || busy) && styles.primaryBtnDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!emailAddress || !password || busy}
        >
          <Text style={styles.primaryBtnText}>
            {busy ? "Creating account…" : "Sign Up"}
          </Text>
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable style={styles.googleBtn} onPress={handleGoogle}>
          <Ionicons name="logo-google" size={18} color={colors.foreground} />
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </Pressable>

        <View style={styles.linkRow}>
          <Text style={styles.linkMuted}>Already have an account? </Text>
          <Link href={"/(auth)/sign-in" as Href}>
            <Text style={styles.link}>Sign in</Text>
          </Link>
        </View>

        {/* Required for sign-up flows: Clerk bot protection */}
        <View nativeID="clerk-captcha" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
