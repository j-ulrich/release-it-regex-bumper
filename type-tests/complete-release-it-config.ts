import { Config as ReleaseItConfig } from "release-it";
import { Configuration as RegexBumperConfig } from "../index";

export default {
  plugins: {
    "@j-ulrich/release-it-regex-bumper": {
      "in": "version.txt",
      "out": "version.txt",
    } satisfies RegexBumperConfig
  }
} satisfies ReleaseItConfig;