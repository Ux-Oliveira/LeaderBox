export default function handler(req, res) {
  console.log("hello function invoked", { method: req.method });
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json({ ok: true, msg: "hello from serverless" });
}
