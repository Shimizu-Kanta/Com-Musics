import { signOut } from '@/app/auth/actions'

export default function LogoutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
      >
        ログアウト
      </button>
    </form>
  )
}