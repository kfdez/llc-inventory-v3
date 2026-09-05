const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { SqliteStore } = require("../src/storage/sqliteStore");
const { CaptureService } = require("../src/capture/captureService");
const { CAPTURE_STATES } = require("../src/capture/captureStates");

function createService() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "llc-inventory-v3-"));
  const store = new SqliteStore(path.join(dir, "test.sqlite"));
  const service = new CaptureService({
    store,
    dryRun: true,
    logger: { error() {} },
    appsScriptClient: {},
    discordAdapter: {
      async createCaptureThread() {
        return { id: "thread-1", name: "Thread One" };
      }
    }
  });
  return { store, service };
}

test("start job becomes active in dry run", async () => {
  const { store, service } = createService();
  const { session, job } = service.requestStart({
    organizerKey: "nace",
    sessionName: "Saturday",
    requestedBy: "Tester"
  });
  assert.equal(session.state, CAPTURE_STATES.START_REQUESTED);

  await service.processStartJob(job);
  const updated = store.getCaptureSession(session.id);
  assert.equal(updated.state, CAPTURE_STATES.ACTIVE);
  assert.equal(updated.discordThreadId, "thread-1");
  assert.equal(updated.appsScriptSession.sheet_tab_name, "DRY RUN");
  store.close();
});

test("stop latest active capture queues and completes stop job", async () => {
  const { store, service } = createService();
  const { session, job } = service.requestStart({
    organizerKey: "nace",
    sessionName: "Saturday",
    requestedBy: "Tester"
  });
  await service.processStartJob(job);

  const stop = service.requestStopLatest({ requestedBy: "Tester" });
  assert.equal(stop.session.state, CAPTURE_STATES.STOP_REQUESTED);

  await service.processStopJob(stop.job);
  const stopped = store.getCaptureSession(session.id);
  assert.equal(stopped.state, CAPTURE_STATES.STOPPED);
  store.close();
});

test("status returns working session and recent jobs", async () => {
  const { store, service } = createService();
  service.requestStart({
    organizerKey: "nace",
    sessionName: "Saturday",
    requestedBy: "Tester"
  });

  const status = service.getStatus();
  assert.equal(status.activeSession.state, CAPTURE_STATES.START_REQUESTED);
  assert.equal(status.recentJobs.length, 1);
  store.close();
});

test("resume stopped session makes it active again and pauses other active sessions", async () => {
  const { store, service } = createService();
  service.dryRun = false;
  service.appsScriptClient = {
    async resumeCaptureSession({ sessionId }) {
      assert.equal(sessionId, "sheet-1");
      return {
        session: {
          session_id: "sheet-1",
          sheet_tab_name: "Sales Log - Previous"
        }
      };
    }
  };

  store.upsertCaptureSession({
    id: "old-local",
    state: CAPTURE_STATES.STOPPED,
    requestedName: "Previous",
    discordThreadId: "thread-old",
    discordThreadName: "Previous Thread",
    appsScriptSession: {
      session_id: "sheet-1",
      sheet_tab_name: "Sales Log - Previous"
    }
  });
  store.upsertCaptureSession({
    id: "current-local",
    state: CAPTURE_STATES.ACTIVE,
    requestedName: "Current",
    discordThreadId: "thread-current",
    discordThreadName: "Current Thread",
    appsScriptSession: {
      session_id: "sheet-2",
      sheet_tab_name: "Sales Log - Current"
    }
  });

  const resumed = await service.resumeSession({
    captureSessionId: "old-local",
    requestedBy: "Tester"
  });

  assert.equal(resumed.state, CAPTURE_STATES.ACTIVE);
  assert.equal(store.getCaptureSession("current-local").state, CAPTURE_STATES.PAUSED);
  store.close();
});

test("resume failed start creates missing Apps Script session for existing thread", async () => {
  const { store, service } = createService();
  service.dryRun = false;
  service.appsScriptClient = {
    async startCaptureSession({ threadId, sessionName }) {
      assert.equal(threadId, "thread-failed");
      assert.equal(sessionName, "Failed Start");
      return {
        session: {
          session_id: "sheet-recovered",
          sheet_tab_name: "Sales Log - Recovered"
        }
      };
    }
  };

  store.upsertCaptureSession({
    id: "failed-local",
    state: CAPTURE_STATES.FAILED,
    requestedName: "Failed Start",
    discordThreadId: "thread-failed",
    discordThreadName: "Failed Thread",
    appsScriptSession: {}
  });

  const resumed = await service.resumeSession({
    captureSessionId: "failed-local",
    requestedBy: "Tester"
  });

  assert.equal(resumed.state, CAPTURE_STATES.ACTIVE);
  assert.equal(resumed.appsScriptSession.session_id, "sheet-recovered");
  store.close();
});

test("resume creates Apps Script session again when saved sheet session cannot resume", async () => {
  const { store, service } = createService();
  service.dryRun = false;
  const calls = [];
  service.appsScriptClient = {
    async resumeCaptureSession({ sessionId, threadId }) {
      calls.push(["resume", sessionId, threadId]);
      throw new Error("Capture session not found.");
    },
    async startCaptureSession({ threadId, sessionName }) {
      calls.push(["start", threadId, sessionName]);
      return {
        session: {
          session_id: "sheet-recreated",
          sheet_tab_name: "Sales Log - Recreated"
        }
      };
    }
  };

  store.upsertCaptureSession({
    id: "local-with-stale-sheet",
    state: CAPTURE_STATES.STOPPED,
    requestedName: "Stale Sheet",
    discordThreadId: "thread-stale",
    discordThreadName: "Stale Thread",
    appsScriptSession: {
      session_id: "missing-sheet-session",
      sheet_tab_name: "Missing Sheet"
    }
  });

  const resumed = await service.resumeSession({
    captureSessionId: "local-with-stale-sheet",
    requestedBy: "Tester"
  });

  assert.equal(resumed.state, CAPTURE_STATES.ACTIVE);
  assert.equal(resumed.appsScriptSession.session_id, "sheet-recreated");
  assert.deepEqual(calls, [
    ["resume", "missing-sheet-session", "thread-stale"],
    ["start", "thread-stale", "Stale Sheet"]
  ]);
  store.close();
});
