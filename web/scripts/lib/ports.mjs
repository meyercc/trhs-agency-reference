// Which dev server, and which headless Chrome, a verify suite talks to.
//
// Chris, 09-24 merge replies: half the suites read APP_PORT/CDP_PORT and half
// read PORT/CDP, "pick one". Until now the only way to know which spelling a
// given script wanted was to open it, and a run with the wrong pair silently
// hit the default port instead — a pass against whatever happened to be
// listening there.
//
// So the names live here, once. APP_PORT/CDP_PORT is the spelling (upstream,
// and what run-verify.mjs exports); PORT/CDP stays accepted because the notes,
// the session-start anchors and the runners outside this repo all still say
// PORT=5178, and nothing outside web/scripts/ can be edited from here. When
// those are updated, drop the second clause in each line and this paragraph.
//
// Defaults stay per-script — every suite picked its own pair so two can run at
// once:  const { app: PORT, cdp: CDP } = ports({ app: '5178', cdp: '9241' });
export function ports({ app = '5175', cdp = '9222' } = {}) {
  return {
    app: String(process.env.APP_PORT || process.env.PORT || app),
    cdp: String(process.env.CDP_PORT || process.env.CDP || cdp),
  };
}
