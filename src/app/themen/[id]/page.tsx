import { TOPICS } from '@/content/topics'
import { TopicDetail } from '@/components/TopicDetail'

export function generateStaticParams() {
  return TOPICS.map((t) => ({ id: t.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const t = TOPICS.find((x) => x.id === id)
  return { title: t ? `${t.title} — OFP Trainer` : 'Thema — OFP Trainer' }
}

export default async function ThemaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <TopicDetail topicId={id} />
}
