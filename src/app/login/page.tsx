import AuthForm from "@/components/auth/AuthForm"

export default function LoginPage() {
    // ログインページでは、AuthFormをそのまま表示します。
    // SupabaseのUIが自動でログインフォームを生成します。
    return <AuthForm />
}