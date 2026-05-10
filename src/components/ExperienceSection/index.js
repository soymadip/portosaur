import styles from './styles.module.css';

export default function ExperienceSection({ id, className, title, subtitle }) {
  return (
    <div id={id} className={`${styles.experienceSection} ${className || ''}`} role="region" aria-label="Experience section">
      <div className={styles.experienceContainer}>
        <div className={styles.experienceHeader}>
          <h2 className={styles.experienceTitle}>
            {title || "Experience"}
          </h2>
          <p className={styles.experienceSubtitle}>
            {subtitle || "My professional journey and work experience"}
          </p>
        </div>
        
        <div className={styles.noticeWrapper}>
          <div className={styles.noticeBox} role="status" aria-live="polite">
            <p className={styles.noticeText}>Coming Soon!</p>
            <p className={styles.noticeDesc}>This section is under construction.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
