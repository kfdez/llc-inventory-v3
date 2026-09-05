const test = require("node:test");
const assert = require("node:assert/strict");
const { CAPTURE_STATES } = require("../src/capture/captureStates");
const {
  canTransition,
  assertTransition,
  transitionCaptureState
} = require("../src/capture/captureStateMachine");

test("allows normal capture start path", () => {
  assert.equal(canTransition(CAPTURE_STATES.START_REQUESTED, CAPTURE_STATES.DISCORD_THREAD_CREATED), true);
  assert.equal(canTransition(CAPTURE_STATES.DISCORD_THREAD_CREATED, CAPTURE_STATES.APPS_SCRIPT_STARTING), true);
  assert.equal(canTransition(CAPTURE_STATES.APPS_SCRIPT_STARTING, CAPTURE_STATES.ACTIVE), true);
});

test("rejects invalid capture transitions", () => {
  assert.throws(
    () => assertTransition(CAPTURE_STATES.START_REQUESTED, CAPTURE_STATES.STOPPED),
    /Invalid capture transition/
  );
});

test("allows stopped sessions to resume", () => {
  assert.doesNotThrow(() => assertTransition(CAPTURE_STATES.STOPPED, CAPTURE_STATES.ACTIVE));
});

test("allows failed sessions to recover", () => {
  assert.doesNotThrow(() => assertTransition(CAPTURE_STATES.FAILED, CAPTURE_STATES.ACTIVE));
});

test("transitionCaptureState applies patch and next state", () => {
  const session = {
    id: "session-1",
    state: CAPTURE_STATES.START_REQUESTED,
    requestedName: "Saturday"
  };
  const next = transitionCaptureState(session, CAPTURE_STATES.DISCORD_THREAD_CREATED, {
    discordThreadId: "123"
  });
  assert.equal(next.state, CAPTURE_STATES.DISCORD_THREAD_CREATED);
  assert.equal(next.discordThreadId, "123");
  assert.equal(next.requestedName, "Saturday");
});
