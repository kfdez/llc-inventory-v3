const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const sharp = require("sharp");
const { ImageAnalysisService } = require("../src/imageAnalysis/imageAnalysisService");
const { scanQrCodes } = require("../src/imageAnalysis/qrScanner");

test("analyzes a QR image with full-image fallback scanner", async () => {
  const service = new ImageAnalysisService({
    config: {
      labelDetectionEnabled: false
    },
    logger: { warn() {} }
  });
  const result = await service.analyzeFile(
    path.resolve(__dirname, "../test-assets/test-qr-single.png")
  );
  assert.equal(result.mode, "full-image");
  assert.ok(result.qrValues.length >= 1);
});

test("scanner preserves multiple detections with the same QR payload", async () => {
  const sourcePath = path.resolve(__dirname, "../test-assets/test-qr-single.png");
  const qrImage = await sharp(sourcePath)
    .resize(420, 420, { fit: "contain", background: "white" })
    .png()
    .toBuffer();
  const combinedImage = await sharp({
    create: {
      width: 920,
      height: 460,
      channels: 3,
      background: "white"
    }
  })
    .composite([
      { input: qrImage, left: 20, top: 20 },
      { input: qrImage, left: 480, top: 20 }
    ])
    .png()
    .toBuffer();

  const qrValues = await scanQrCodes(combinedImage);

  assert.equal(qrValues.length, 2);
  assert.equal(qrValues[0], qrValues[1]);
});
