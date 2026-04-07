import React from 'react';
import { tokens } from './tokens';

type SetupTab = 'env' | 'httpclient' | 'iisexpress' | 'wcf';

interface ProxySetupGuideProps {
  activeTab: SetupTab;
  onTabChange: (tab: SetupTab) => void;
}

const SETUP_TABS: { id: SetupTab; label: string }[] = [
  { id: 'env', label: 'Environment Variable' },
  { id: 'httpclient', label: '.NET HttpClient' },
  { id: 'iisexpress', label: 'IIS Express' },
  { id: 'wcf', label: 'WCF / WebServiceClient' },
];

export function ProxySetupGuide({ activeTab, onTabChange }: ProxySetupGuideProps) {
  return (
    <div style={{ background: tokens.surface.base, borderRadius: tokens.radius.lg, border: `1px solid ${tokens.border.default}` }}>
      {/* Tab row */}
      <div style={{
        display: 'flex',
        borderBottom: `1px solid ${tokens.border.default}`,
        background: tokens.surface.elevated,
        borderRadius: `${tokens.radius.lg} ${tokens.radius.lg} 0 0`,
        overflow: 'hidden',
      }}>
        {SETUP_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              padding: `${tokens.space['3']} ${tokens.space['5']}`,
              background: activeTab === tab.id ? tokens.surface.base : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${tokens.status.accent}` : 'none',
              color: activeTab === tab.id ? tokens.text.white : tokens.text.secondary,
              fontSize: tokens.fontSize.sm,
              cursor: 'pointer',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: tokens.space['5'] }}>
        {activeTab === 'env' && <EnvVarGuide />}
        {activeTab === 'httpclient' && <HttpClientGuide />}
        {activeTab === 'iisexpress' && <IisExpressGuide />}
        {activeTab === 'wcf' && <WcfGuide />}
      </div>
    </div>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre style={{
      background: tokens.surface.elevated,
      border: `1px solid ${tokens.border.default}`,
      borderRadius: tokens.radius.md,
      padding: tokens.space['4'],
      fontSize: tokens.fontSize.sm,
      color: tokens.syntax.string,
      overflowX: 'auto',
      margin: `${tokens.space['3']} 0 0 0`,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }}>
      {children}
    </pre>
  );
}

function GuideText({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: tokens.fontSize.sm, color: tokens.text.secondary, margin: `0 0 ${tokens.space['3']} 0`, lineHeight: '1.6' }}>
      {children}
    </p>
  );
}

const inlineCode: React.CSSProperties = {
  background: tokens.surface.elevated,
  padding: '1px 4px',
  borderRadius: tokens.radius.sm,
  fontSize: tokens.fontSize.xs,
  color: tokens.syntax.param,
};

function EnvVarGuide() {
  return (
    <div>
      <GuideText>
        Set environment variables before starting your app. This works for most HTTP clients including .NET
        HttpClient (via <code style={inlineCode}>HttpClientHandler.UseProxy = true</code> — the default).
      </GuideText>
      <GuideText><strong>Windows (Command Prompt / PowerShell):</strong></GuideText>
      <CodeBlock>{`set HTTP_PROXY=http://127.0.0.1:8888\nset HTTPS_PROXY=http://127.0.0.1:8888`}</CodeBlock>
      <CodeBlock>{`$env:HTTP_PROXY = "http://127.0.0.1:8888"\n$env:HTTPS_PROXY = "http://127.0.0.1:8888"`}</CodeBlock>
      <GuideText><strong>macOS / Linux:</strong></GuideText>
      <CodeBlock>{`export HTTP_PROXY=http://127.0.0.1:8888\nexport HTTPS_PROXY=http://127.0.0.1:8888`}</CodeBlock>
      <GuideText>
        For HTTPS traffic you also need to trust the CA certificate (see the Settings tab).
      </GuideText>
    </div>
  );
}

function HttpClientGuide() {
  return (
    <div>
      <GuideText>
        Configure <code style={inlineCode}>HttpClient</code> directly in code — useful when you can't set
        environment variables or need per-client control.
      </GuideText>
      <CodeBlock>{`var handler = new HttpClientHandler
{
    Proxy = new WebProxy("http://127.0.0.1:8888"),
    UseProxy = true,
    // Trust all certs (dev only) — or install the CA cert instead:
    ServerCertificateCustomValidationCallback = (_, _, _, _) => true,
};
var client = new HttpClient(handler);`}</CodeBlock>
      <GuideText>
        For production-style HTTPS inspection, install the CA certificate via the Settings tab and
        remove the <code style={inlineCode}>ServerCertificateCustomValidationCallback</code> override.
      </GuideText>
    </div>
  );
}

function IisExpressGuide() {
  return (
    <div>
      <GuideText>
        IIS Express itself doesn't proxy outbound traffic, but the ASP.NET application it hosts does.
        Set the proxy via the app's <code style={inlineCode}>web.config</code> or a startup
        <code style={inlineCode}> launchSettings.json</code> environment block.
      </GuideText>
      <GuideText><strong>Option 1 — web.config (system.net proxy):</strong></GuideText>
      <CodeBlock>{`<configuration>
  <system.net>
    <defaultProxy enabled="true">
      <proxy proxyaddress="http://127.0.0.1:8888" bypassonlocal="false" />
    </defaultProxy>
  </system.net>
</configuration>`}</CodeBlock>
      <GuideText><strong>Option 2 — launchSettings.json environment variables:</strong></GuideText>
      <CodeBlock>{`{
  "profiles": {
    "IIS Express": {
      "environmentVariables": {
        "HTTPS_PROXY": "http://127.0.0.1:8888",
        "HTTP_PROXY": "http://127.0.0.1:8888"
      }
    }
  }
}`}</CodeBlock>
      <GuideText>
        Restart IIS Express after making changes. Trust the CA certificate in Windows
        Certificate Manager to avoid SSL errors.
      </GuideText>
    </div>
  );
}

function WcfGuide() {
  return (
    <div>
      <GuideText>
        WCF clients use <code style={inlineCode}>system.net/defaultProxy</code> by default (same as HttpClient).
        Enable <code style={inlineCode}>useDefaultWebProxy</code> on the binding or set it explicitly in config.
      </GuideText>
      <GuideText><strong>app.config / web.config:</strong></GuideText>
      <CodeBlock>{`<system.serviceModel>
  <bindings>
    <basicHttpBinding>
      <binding name="MyBinding">
        <security mode="Transport" />
      </binding>
    </basicHttpBinding>
  </bindings>
</system.serviceModel>

<system.net>
  <defaultProxy enabled="true" useDefaultCredentials="true">
    <proxy proxyaddress="http://127.0.0.1:8888" bypassonlocal="false" />
  </defaultProxy>
</system.net>`}</CodeBlock>
      <GuideText><strong>Code (CoreWCF / WCF client):</strong></GuideText>
      <CodeBlock>{`var binding = new BasicHttpBinding();
binding.UseDefaultWebProxy = true;

// Or set explicitly:
System.Net.WebRequest.DefaultWebProxy =
    new System.Net.WebProxy("http://127.0.0.1:8888");`}</CodeBlock>
    </div>
  );
}
