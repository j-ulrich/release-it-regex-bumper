import { Config as ReleaseItConfig } from "release-it";
import { Configuration as RegexBumperConfig } from "../index";

export default {
  plugins: {
    "@j-ulrich/release-it-regex-bumper": {

    } satisfies RegexBumperConfig
  }
} satisfies ReleaseItConfig;