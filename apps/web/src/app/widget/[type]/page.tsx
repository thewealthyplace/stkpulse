import { WidgetRenderer } from '@/components/widgets/WidgetRenderer';

export default function WidgetPage({ searchParams }: { searchParams: any }) {
  const config = {
    type: searchParams.type || 'stx-price',
    theme: searchParams.theme || 'dark',
    period: searchParams.period || '30d',
    contract: searchParams.contract,
    protocol: searchParams.protocol,
    collection: searchParams.collection,
  };

  return (
    <html>
      <head>
        <style>{`
          body { margin: 0; padding: 0; overflow: hidden; }
        `}</style>
      </head>
      <body>
        <WidgetRenderer config={config} />
      </body>
    </html>
  );
}
