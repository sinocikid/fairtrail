import styles from './page.module.css';

export default function HomePage() {
  return (
    <main className={styles.root}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Fairtrail</h1>
        <p className={styles.tagline}>
          The price trail airlines don&apos;t show you
        </p>
      </div>
    </main>
  );
}
