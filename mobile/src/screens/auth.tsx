import { Redirect } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { FormField } from "@/components/form-field";
import { NativeButton } from "@/components/native-button";
import { useAuth } from "@/hooks/use-auth";
import { colors, spacing } from "@/theme/colors";

export function AuthScreen() {
  const { configured, message, session, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (session) return <Redirect href="/(tabs)/(studio)" />;

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "signup") await signUp(name, email, password);
      else await signIn(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Authentication failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={process.env.EXPO_OS === "ios" ? "padding" : undefined}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          gap: spacing.xl,
          padding: spacing.lg,
          paddingTop: 80,
          paddingBottom: 48,
        }}
      >
        <View style={{ gap: spacing.sm }}>
          <Text
            selectable
            style={{
              color: colors.accent,
              fontSize: 12,
              fontWeight: "800",
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Project Chaplin
          </Text>
          <Text
            selectable
            style={{
              color: colors.label,
              fontSize: 44,
              lineHeight: 46,
              fontWeight: "900",
              letterSpacing: -1.5,
            }}
          >
            Make a character perform.
          </Text>
          <Text
            selectable
            style={{ color: colors.secondaryLabel, fontSize: 17, lineHeight: 25 }}
          >
            Build an original AI actor, write one sharp moment, and turn it into
            a five-second Spark.
          </Text>
        </View>

        <View style={{ gap: spacing.md }}>
          {!configured ? (
            <Text
              selectable
              style={{ color: colors.warning, fontSize: 14, lineHeight: 21 }}
            >
              Add the three EXPO_PUBLIC values from mobile/.env.example before
              signing in.
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <NativeButton
                variant={mode === "signup" ? "filled" : "outlined"}
                onPress={() => setMode("signup")}
              >
                Create account
              </NativeButton>
            </View>
            <View style={{ flex: 1 }}>
              <NativeButton
                variant={mode === "login" ? "filled" : "outlined"}
                onPress={() => setMode("login")}
              >
                Sign in
              </NativeButton>
            </View>
          </View>
          {mode === "signup" ? (
            <FormField
              label="Name or studio"
              value={name}
              onChangeText={setName}
              autoComplete="name"
              autoCapitalize="words"
            />
          ) : null}
          <FormField
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoComplete="email"
            autoCapitalize="none"
          />
          <FormField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            autoCapitalize="none"
            hint="Use at least eight characters."
          />
          {error ? (
            <Text selectable style={{ color: colors.danger, lineHeight: 21 }}>
              {error}
            </Text>
          ) : null}
          {message ? (
            <Text selectable style={{ color: colors.success, lineHeight: 21 }}>
              {message}
            </Text>
          ) : null}
          <NativeButton
            loading={busy}
            disabled={
              !configured ||
              !email.trim() ||
              password.length < 8 ||
              (mode === "signup" && !name.trim())
            }
            onPress={() => void submit()}
          >
            {mode === "signup" ? "Enter the studio" : "Continue"}
          </NativeButton>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
