const withPWA = require("next-pwa")({
  dest: "public",
  register: false,
  skipWaiting: true,
  disable: process.env.NODE_ENV !== "production",
});

/** @type {import('next').NextConfig} */
module.exports = withPWA({
  /* config options here */
});