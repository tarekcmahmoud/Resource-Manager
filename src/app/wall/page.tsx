import { TopBar } from '@/components/TopBar';
import s from './wall.module.css';

export const metadata = { title: 'Wall · Resource Manager' };

export default function WallPage() {
  return (
    <main>
      <TopBar current="wall" />
      <p className={s.note}>The inspiration wall arrives in stage 3.</p>
    </main>
  );
}
