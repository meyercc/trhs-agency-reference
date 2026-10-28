import { Button, Toast, ToastStack } from '../components';
import { useToasts } from '../state/Toasts';

/** The app's one toast stack (TH-484): whatever `useToasts().notify` raised, newest last. */
export function ToastHost() {
  const { toasts, dismiss } = useToasts();
  return (
    <ToastStack>
      {toasts.map((t) => (
        <Toast
          key={t.id}
          tone={t.tone}
          icon={t.icon}
          title={t.title}
          message={t.message}
          onClose={() => dismiss(t.id)}
          actions={
            t.actions?.length ? (
              <>
                {t.actions.map((a) => (
                  <Button key={a.label} size="sm" variant={a.variant ?? 'default'} onClick={a.onPress}>
                    {a.label}
                  </Button>
                ))}
              </>
            ) : undefined
          }
        />
      ))}
    </ToastStack>
  );
}
