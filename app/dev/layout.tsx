import { redirect } from 'next/navigation'

/** Dev-only layout: block access in production */
export default function DevLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (process.env.NODE_ENV === 'production') {
    redirect('/')
  }
  return <>{children}</>
}
