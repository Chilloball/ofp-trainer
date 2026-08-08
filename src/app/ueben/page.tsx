import { Suspense } from 'react'
import { Practice } from '@/components/Practice'

export const metadata = { title: 'Üben — OFP Trainer' }

export default function UebenPage() {
  return (
    <Suspense fallback={null}>
      <Practice />
    </Suspense>
  )
}
