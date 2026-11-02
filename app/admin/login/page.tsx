import Logo from '@/components/Logo';
import LoginForm from './LoginForm';
import styles from '@/components/site.module.css';

export const metadata = { title: 'Sign in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return (
    <main className={styles.main}>
      <div className={styles.container} style={{ maxWidth: 480, paddingTop: 80, paddingBottom: 80 }}>
        <Logo size={48} />
        <h1 className={styles.h2Small} style={{ marginTop: 20 }}>
          Calendar admin
        </h1>
        <p className={styles.body} style={{ marginTop: 8 }}>
          {expired ? 'That sign-in link has expired or was already used. Ask for a new one.' : 'We will email you a link to sign in. No password.'}
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
