'use server'

import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  // headers() の呼び出しに await を追加します。これが修正点です。
  const headersList = await headers()
  const origin = headersList.get('origin')

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const nickname = formData.get('nickname') as string
  const userIdText = formData.get('user_id_text') as string
  const birthday = formData.get('birthday') as string

  const supabase = createClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nickname,
        user_id_text: userIdText,
        birthday,
      },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  })

  if (error) {
    console.error('Sign up error:', error.message)
    return redirect('/signup?message=Could not authenticate user')
  }

  return redirect('/login?message=Check email to continue sign in process')
}

export async function signOut() {
  const supabase = createClient()
  await supabase.auth.signOut()
  return redirect('/login')
}