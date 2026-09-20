import React, { useState, useEffect } from 'react';
import { Settings, Save, RotateCcw, Code, CheckCircle, AlertCircle, Sparkles, Globe, Key, Cpu } from 'lucide-react';
import { BotConfig } from '../types';
import { safeFetchJson } from '../lib/safeJson';

interface ConfigTabProps {
  onRestartNeeded: () => void;
}

export const ConfigTab: React.FC<ConfigTabProps> = ({ onRestartNeeded }) => {
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRawMode, setIsRawMode] = useState(false);
  const [rawText, setRawText] = useState('');

  // Form states
  const [botname, setBotname] = useState('');
  const [author, setAuthor] = useState('');
  const [packname, setPackname] = useState('');
  const [timezone, setTimezone] = useState('');
  const [customPairingCode, setCustomPairingCode] = useState('');
  const [numberBot, setNumberBot] = useState('');
  const [ownersInput, setOwnersInput] = useState('');
  const [prefixesInput, setPrefixesInput] = useState('');

  // Mahiru AI states
  const [mahiruApiUrl, setMahiruApiUrl] = useState('');
  const [mahiruApiKey, setMahiruApiKey] = useState('');
  const [mahiruCustomModel, setMahiruCustomModel] = useState('gpt-4o-mini');
  const [mahiruGeminiKey, setMahiruGeminiKey] = useState('');
  const [mahiruGeminiModel, setMahiruGeminiModel] = useState('gemini-2.5-flash');

  const fetchConfig = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch('/api/bot/config');
      const data = await safeFetchJson<BotConfig | null>(res, null);
      if (!data) {
        throw new Error('Konfigurasi kosong atau server sedang menyiapkan data');
      }
      setConfig(data);
      setBotname(data.botname || 'Oguri Cap');
      setAuthor(data.author || 'Shiro');
      setPackname(data.packname || '✦ 𝐎𝐠𝐮𝐫𝐢 𝐂𝐚𝐩');
      setTimezone(data.timezone || 'Asia/Jakarta');
      setCustomPairingCode(data.custom_pairing_code || 'OGURICAP');
      setNumberBot(data.number_bot || '');
      setOwnersInput((data.owners || []).join(', '));
      setPrefixesInput((data.prefixes || []).join(', '));
      setMahiruApiUrl(data.mahiru_api_url || '');
      setMahiruApiKey(data.mahiru_api_key || '');
      setMahiruCustomModel(data.mahiru_custom_model || 'gpt-4o-mini');
      setMahiruGeminiKey(data.mahiru_gemini_key || '');
      setMahiruGeminiModel(data.mahiru_gemini_model || 'gemini-2.5-flash');
      setRawText(data.rawContent || '');
    } catch (err: any) {
      setErrorMessage('Gagal memuat konfigurasi: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);
    setSaveSuccess(false);

    try {
      let payload: any = {};
      if (isRawMode) {
        payload = { rawContent: rawText };
      } else {
        const parsedOwners = ownersInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        const parsedPrefixes = prefixesInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        payload = {
          botname,
          author,
          packname,
          timezone,
          custom_pairing_code: customPairingCode,
          number_bot: numberBot,
          owners: parsedOwners,
          prefixes: parsedPrefixes,
          mahiru_api_url: mahiruApiUrl,
          mahiru_api_key: mahiruApiKey,
          mahiru_custom_model: mahiruCustomModel,
          mahiru_gemini_key: mahiruGeminiKey,
          mahiru_gemini_model: mahiruGeminiModel,
        };
      }

      const res = await fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await safeFetchJson<{ error?: string; success?: boolean }>(res, {});
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Gagal menyimpan');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      await fetchConfig();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-500">
        <Settings className="w-8 h-8 animate-spin mx-auto text-blue-600 mb-3" />
        <p className="text-sm">Memuat pengaturan OguriCap (settings.js)...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Settings className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Konfigurasi Bot (settings.js)
            </h2>
            <p className="text-xs text-slate-500">
              Ubah identitas bot, packname stiker, owner, prefix, dan custom pairing code
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsRawMode(!isRawMode)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
              isRawMode
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <Code className="w-3.5 h-3.5" />
            {isRawMode ? 'Mode Visual' : 'Mode Raw (Script)'}
          </button>

          <button
            onClick={fetchConfig}
            title="Reset ke pengaturan file saat ini"
            className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Notifications */}
      {saveSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>Pengaturan berhasil disimpan ke <code>OguriCap/settings.js</code>!</span>
          </div>
          <button
            onClick={onRestartNeeded}
            className="text-xs font-semibold underline text-emerald-900 hover:text-emerald-700"
          >
            Restart bot sekarang untuk menerapkan?
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {isRawMode ? (
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            File Asli: OguriCap/settings.js
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={22}
            className="w-full p-3 font-mono text-xs bg-slate-950 text-slate-200 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Bot Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nama Bot (botname)
            </label>
            <input
              type="text"
              value={botname}
              onChange={(e) => setBotname(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Author Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Author Stiker (author)
            </label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Pack Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Packname Stiker (packname)
            </label>
            <input
              type="text"
              value={packname}
              onChange={(e) => setPackname(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Timezone */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Zona Waktu (timezone)
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="Asia/Jakarta">Asia/Jakarta (WIB)</option>
              <option value="Asia/Makassar">Asia/Makassar (WITA)</option>
              <option value="Asia/Jayapura">Asia/Jayapura (WIT)</option>
            </select>
          </div>

          {/* Custom Pairing Code */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Custom Pairing Code Default
            </label>
            <input
              type="text"
              maxLength={8}
              value={customPairingCode}
              onChange={(e) => setCustomPairingCode(e.target.value.toUpperCase())}
              placeholder="OGURICAP"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Number Bot Fallback */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nomor Bot Tersimpan (number_bot)
            </label>
            <input
              type="text"
              value={numberBot}
              onChange={(e) => setNumberBot(e.target.value)}
              placeholder="6281563808289 (opsional)"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Owners List */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Nomor Owner WhatsApp (Pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={ownersInput}
              onChange={(e) => setOwnersInput(e.target.value)}
              placeholder="6281563808289, 628987654321"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Prefixes */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Awalan Perintah / Prefix (Pisahkan dengan koma)
            </label>
            <input
              type="text"
              value={prefixesInput}
              onChange={(e) => setPrefixesInput(e.target.value)}
              placeholder="., !, +"
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Mahiru Shiina AI Configuration Box */}
          <div className="sm:col-span-2 pt-4 border-t border-slate-200">
            <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 mb-4">
              <div className="flex items-center gap-2 mb-2 text-amber-900 font-semibold text-sm">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Karakter Mahiru Shiina (Pengaturan AI Fleksibel)</span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed mb-2">
                Konfigurasi engine AI untuk karakter Mahiru Shiina di <code>OguriCap/settings.js</code>:
              </p>
              <ul className="text-xs text-amber-700/90 space-y-1 list-disc list-inside">
                <li><strong>API Pihak Ketiga (Custom URL):</strong> Jika diisi, Mahiru memanggil URL ini (mendukung GET endpoint atau OpenAI-compatible chat completions).</li>
                <li><strong>Google Gemini Resmi:</strong> Jika URL di atas dikosongkan, Mahiru memakai Google Gemini resmi menggunakan API Key yang Anda masukkan.</li>
                <li><strong>Scraper Gratis Otomatis:</strong> Jika URL dan API Key kosong, Mahiru tetap aktif menggunakan scraper multi-model gratis.</li>
              </ul>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Third Party URL */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-blue-600" />
                  URL API Pihak Ketiga (apiUrl)
                </label>
                <input
                  type="text"
                  value={mahiruApiUrl}
                  onChange={(e) => setMahiruApiUrl(e.target.value)}
                  placeholder="https://api.example.com/ai?text= atau https://api.openai.com/v1/chat/completions (kosongkan jika pakai Gemini)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Kosongkan jika ingin memakai Google Gemini Resmi atau scraper gratis.
                </span>
              </div>

              {/* Third Party Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                  Nama Model Pihak Ketiga (customModel)
                </label>
                <input
                  type="text"
                  value={mahiruCustomModel}
                  onChange={(e) => setMahiruCustomModel(e.target.value)}
                  placeholder="gpt-4o-mini / claude-3-5-sonnet / deepseek-chat"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Third Party API Key (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-slate-500" />
                  API Key Pihak Ketiga (Opsional)
                </label>
                <input
                  type="password"
                  value={mahiruApiKey}
                  onChange={(e) => setMahiruApiKey(e.target.value)}
                  placeholder="Bearer token jika API pihak ketiga membutuhkan autentikasi"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Gemini Official API Key */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-600" />
                  Google Gemini API Key Resmi (geminiKey)
                </label>
                <input
                  type="password"
                  value={mahiruGeminiKey}
                  onChange={(e) => setMahiruGeminiKey(e.target.value)}
                  placeholder="AIzaSy... (Google AI Studio Key)"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Dipakai otomatis jika URL pihak ketiga di atas kosong.
                </span>
              </div>

              {/* Gemini Official Model */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-amber-600" />
                  Model Gemini Resmi (geminiModel)
                </label>
                <input
                  type="text"
                  value={mahiruGeminiModel}
                  onChange={(e) => setMahiruGeminiModel(e.target.value)}
                  placeholder="gemini-2.5-flash"
                  className="w-full px-3 py-2 text-sm rounded-xl border border-slate-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Contoh: gemini-2.5-flash, gemini-3.1-flash-lite.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-end">
        <button
          id="save-config-btn"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
};
