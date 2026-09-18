import Avatar from '@/components/Avatar/Avatar';
import Popover from '@/components/Popover/Popover';
import styles from './AccountMenu.module.css';

interface Props {
  email: string | null;
  onManageLabels: () => void;
  onSignOut: () => void;
}

// Presentational: it shows who is connected and offers to leave. Revoking the
// session is the screen's business.
export default function AccountMenu({
  email,
  onManageLabels,
  onSignOut,
}: Props) {
  return (
    <Popover
      align="end"
      trigger={<Avatar email={email} label="Mon compte" />}
    >
      {(close) => (
        <div className={styles.menu}>
          <div className={styles.identity}>
            <Avatar email={email} />
            <span className={styles.who}>
              <span className={styles.email}>
                {email ?? 'Connecté'}
              </span>
              <span className={styles.device}>
                Connecté sur cet appareil
              </span>
            </span>
          </div>
          <div className={styles.separator} />
          <button
            type="button"
            className={styles.entry}
            onClick={() => {
              close();
              onManageLabels();
            }}
          >
            Gérer les étapes
          </button>
          <div className={styles.separator} />
          <button
            type="button"
            className={styles.signOut}
            onClick={() => {
              close();
              onSignOut();
            }}
          >
            Se déconnecter
          </button>
        </div>
      )}
    </Popover>
  );
}
