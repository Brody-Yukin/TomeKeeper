import { Ionicons } from "@expo/vector-icons";
import { useSignIn, useSSO } from "@clerk/expo";
import * as AuthSession from "expo-auth-session";
import { Link, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useState } from "react";
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

// Preloads the browser on Android to reduce OAuth load time
function useWarmUpBrowser() {
  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);
}

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  useWarmUpBrowser();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();
  const [emailAddress, setEmailAddress] = useState("");
  const [password, setPassword] = useState("");
  const [oauthError, setOauthError] = useState("");

  const styles = createAuthStyles(colors, insets.top);

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
    const { error } = await signIn.password({ emailAddress, password });
    if (error) return;
    if (signIn.status === "complete") {
      await signIn.finalize({ navigate: navigateHome });
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
      setOauthError("Google sign-in didn't finish. Please try again.");
    }
  }, [startSSOFlow]);

  const busy = fetchStatus === "fetching";
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
          <Text style={styles.tagline}>Your personal library, in your pocket</Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to your library</Text>

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
        {errors.fields.identifier && (
          <Text style={styles.error}>{errors.fields.identifier.message}</Text>
        )}

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          placeholder="Your password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          onChangeText={setPassword}
        />
        {errors.fields.password && (
          <Text style={styles.error}>{errors.fields.password.message}</Text>
        )}
        {!errors.fields.identifier && !errors.fields.password && generalError ? (
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
            {busy ? "Signing in…" : "Sign In"}
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
          <Text style={styles.linkMuted}>No account yet? </Text>
          <Link href={"/(auth)/sign-up" as Href}>
            <Text style={styles.link}>Sign up</Text>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
