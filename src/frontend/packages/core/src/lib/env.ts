import z from "zod";

const schema = z
  .object({
    NEXT_PUBLIC_APP_VERSION: z.string().default("v0.0.0"),
    NEXT_PUBLIC_PROJECT_PAGE: z.url().default("https://www.ocelescope.org/"),
    NEXT_PUBLIC_DOCS_URL: z
      .url()
      .default("https://www.ocelescope.org/getting-started/download/"),
    NEXT_PUBLIC_PLUGIN_DEV_GUIDE_URL: z
      .url()
      .default("https://www.ocelescope.org/plugin-development/"),
    NEXT_PUBLIC_PLUGIN_LIBRARY_URL: z
      .url()
      .default("https://www.ocelescope.org/community/plugin-library/"),
    NEXT_PUBLIC_REPORT_BUG_URL: z
      .url()
      .default("https://www.ocelescope.org/community/report-bug/"),
    NEXT_PUBLIC_TROUBLESHOOTING_URL: z
      .url()
      .default("https://www.ocelescope.org/community/troubleshooting/"),
    NEXT_PUBLIC_REQUEST_FEATURE_URL: z
      .url()
      .default("https://www.ocelescope.org/community/request-feature/"),
    NEXT_PUBLIC_SUBMIT_PLUGIN_URL: z
      .url()
      .default("https://www.ocelescope.org/community/submit-plugin/"),
    NEXT_PUBLIC_REQUEST_ENVIRONMENT_URL: z
      .url()
      .default("https://www.ocelescope.org/community/request-package/"),
    NEXT_PUBLIC_CONTACT_EMAIL: z
      .string()
      .default("ocelescope@pads.rwth-aachen.de"),
  })
  .transform((env) => ({
    appVersion: env.NEXT_PUBLIC_APP_VERSION,
    projectPage: env.NEXT_PUBLIC_PROJECT_PAGE,
    docsUrl: env.NEXT_PUBLIC_DOCS_URL,
    pluginDevGuideUrl: env.NEXT_PUBLIC_PLUGIN_DEV_GUIDE_URL,
    pluginLibraryUrl: env.NEXT_PUBLIC_PLUGIN_LIBRARY_URL,
    reportBugUrl: env.NEXT_PUBLIC_REPORT_BUG_URL,
    requestFeatureUrl: env.NEXT_PUBLIC_REQUEST_FEATURE_URL,
    submitPluginUrl: env.NEXT_PUBLIC_SUBMIT_PLUGIN_URL,
    troubleshootingUrl: env.NEXT_PUBLIC_TROUBLESHOOTING_URL,
    requestEnvironmentUrl: env.NEXT_PUBLIC_REQUEST_ENVIRONMENT_URL,
    contactEmail: env.NEXT_PUBLIC_CONTACT_EMAIL,
  }));

export const env = schema.parse({
  NEXT_PUBLIC_APP_VERSION: process.env.NEXT_PUBLIC_APP_VERSION,
  NEXT_PUBLIC_PROJECT_PAGE: process.env.NEXT_PUBLIC_PROJECT_PAGE,
  NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
  NEXT_PUBLIC_PLUGIN_DEV_GUIDE_URL:
    process.env.NEXT_PUBLIC_PLUGIN_DEV_GUIDE_URL,
  NEXT_PUBLIC_PLUGIN_LIBRARY_URL: process.env.NEXT_PUBLIC_PLUGIN_LIBRARY_URL,
  NEXT_PUBLIC_REPORT_BUG_URL: process.env.NEXT_PUBLIC_REPORT_BUG_URL,
  NEXT_PUBLIC_TROUBLESHOOTING_URL: process.env.NEXT_PUBLIC_TROUBLESHOOTING_URL,
  NEXT_PUBLIC_REQUEST_FEATURE_URL: process.env.NEXT_PUBLIC_REQUEST_FEATURE_URL,
  NEXT_PUBLIC_SUBMIT_PLUGIN_URL: process.env.NEXT_PUBLIC_SUBMIT_PLUGIN_URL,
  NEXT_PUBLIC_REQUEST_ENVIRONMENT_URL:
    process.env.NEXT_PUBLIC_REQUEST_ENVIRONMENT_URL,
  NEXT_PUBLIC_CONTACT_EMAIL: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
});
