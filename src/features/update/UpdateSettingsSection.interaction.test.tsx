/** @vitest-environment jsdom */

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { UpdateSettingsSection } from "./UpdateSettingsSection";
import { saveUpdateSettings } from "./api";
import type { UpdateSettings, UpdateState } from "./types";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  message: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: vi.fn(),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async () => () => undefined),
}));

vi.mock("../../components/SlidingButtonGroup", () => ({
  SlidingButtonGroup: ({
    options,
    value,
    onChange,
  }: {
    options: Array<{ value: string; label: string }>;
    value: string;
    onChange: (next: string) => void;
  }) => (
    <div>
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.label}
          {value === option.value ? " (selected)" : ""}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("./api", () => ({
  checkForUpdates: vi.fn(),
  downloadUpdate: vi.fn(),
  installUpdate: vi.fn(),
  cancelUpdate: vi.fn(),
  getUpdateStatus: vi.fn(),
  getUpdateSettings: vi.fn(),
  saveUpdateSettings: vi.fn(),
  getMirrorChyanCdk: vi.fn(),
  setMirrorChyanCdk: vi.fn(),
}));

const mockedSaveUpdateSettings = vi.mocked(saveUpdateSettings);

const settings: UpdateSettings = {
  autoCheck: true,
  autoDownload: false,
  checkIntervalHours: 24,
  checkSourcePreference: "githubFirst",
  downloadSourcePreference: "mirrorChyanFirst",
  channel: "stable",
  allowPrerelease: false,
  lastAutoCheckAt: null,
  hasMirrorChyanCdk: false,
};

const status: UpdateState = {
  status: "available",
  currentVersion: "1.0.4",
  latestVersion: "1.0.5",
  channel: "stable",
  assetName: "floral-notepaper_1.0.5_macos_aarch64_app.zip",
  assetPath: null,
  assetSha256: "abc",
  assetSize: 12345678,
  source: "github",
  checkedAt: "2026-05-26T12:00:00Z",
  downloadedAt: null,
  installLogPath: null,
  installMode: null,
  installStartedAt: null,
  installScheduledAt: null,
  lastError: null,
};

interface RenderResult {
  container: HTMLDivElement;
  root: Root;
}

async function renderSection(
  mode: "full" | "settingsOnly" = "settingsOnly",
): Promise<RenderResult> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <UpdateSettingsSection initialSettings={settings} initialStatus={status} mode={mode} />,
    );
  });
  return { container, root };
}

describe("UpdateSettingsSection switches", () => {
  beforeAll(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    mockedSaveUpdateSettings.mockReset();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("toggles auto-check and auto-download via switch buttons", async () => {
    mockedSaveUpdateSettings
      .mockResolvedValueOnce({ ...settings, autoCheck: false })
      .mockResolvedValueOnce({ ...settings, autoCheck: false, autoDownload: true });

    const { container, root } = await renderSection("full");
    try {
      const switches = container.querySelectorAll<HTMLButtonElement>('button[role="switch"]');
      expect(switches).toHaveLength(2);
      expect(switches[0].getAttribute("aria-checked")).toBe("true");
      expect(switches[1].getAttribute("aria-checked")).toBe("false");

      await act(async () => {
        switches[0].click();
        await Promise.resolve();
      });

      expect(mockedSaveUpdateSettings).toHaveBeenNthCalledWith(1, {
        ...settings,
        autoCheck: false,
      });
      expect(switches[0].getAttribute("aria-checked")).toBe("false");

      await act(async () => {
        switches[1].click();
        await Promise.resolve();
      });

      expect(mockedSaveUpdateSettings).toHaveBeenNthCalledWith(2, {
        ...settings,
        autoCheck: false,
        autoDownload: true,
      });
      expect(switches[1].getAttribute("aria-checked")).toBe("true");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });

  test("keeps settings mounted and shows only error notice when save fails", async () => {
    mockedSaveUpdateSettings.mockRejectedValueOnce({ code: "updateDownloadNotReady" });

    const { container, root } = await renderSection("full");
    try {
      const switches = container.querySelectorAll<HTMLButtonElement>('button[role="switch"]');
      expect(switches).toHaveLength(2);

      await act(async () => {
        switches[1].click();
        await Promise.resolve();
      });

      expect(mockedSaveUpdateSettings).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => expect(container.textContent).toContain("当前没有可下载的更新包"));
      expect(container.textContent).toContain("自动检查更新");
      expect(container.textContent).toContain("有新版本时自动下载");
      expect(container.querySelectorAll('button[role="switch"]')).toHaveLength(2);
      expect(container.textContent).not.toContain("更新设置已保存");
    } finally {
      await act(async () => {
        root.unmount();
      });
    }
  });
});
