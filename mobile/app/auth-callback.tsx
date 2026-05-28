import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { createSessionFromUrl } from "@/src/lib/authSession";

WebBrowser.maybeCompleteAuthSession();

export default function AuthCallback() {
  const url = Linking.useLinkingURL();

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
    if (url) {
      createSessionFromUrl(url).catch((err) => {
        console.error("[auth-callback]", err);
      });
    }
  }, [url]);

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#000",
      }}
    >
      <ActivityIndicator color="#fff" />
    </View>
  );
}
