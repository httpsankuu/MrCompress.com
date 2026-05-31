import { Toaster } from 'sonner';

export default function ToasterProvider() {
  return (
    <Toaster 
      position="bottom-right" 
      richColors 
      closeButton 
      theme="inherit"
    />
  );
}
