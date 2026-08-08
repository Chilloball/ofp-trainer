import { promises as fs } from 'node:fs'
import path from 'node:path'
import { ExamSession } from '@/components/ExamSession'

export async function generateStaticParams() {
  const dir = path.join(process.cwd(), 'content', 'exams')
  const files = (await fs.readdir(dir)).filter((f) => f.endsWith('.json'))
  const ids: { id: string }[] = []
  for (const f of files) {
    const raw = JSON.parse(await fs.readFile(path.join(dir, f), 'utf8'))
    for (const exam of Array.isArray(raw) ? raw : [raw]) {
      if (exam?.id) ids.push({ id: exam.id })
    }
  }
  return ids
}

export const metadata = { title: 'Klausur — OFP Trainer' }

export default async function KlausurDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <ExamSession examId={id} />
}
