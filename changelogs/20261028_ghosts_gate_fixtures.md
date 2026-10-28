# Keep the full ghost browser gate reliable

- Feed the camera lifecycle fixture continuing canvas frames, and stop its paint timer with the track.
- Close the previous camera context before each case and release it after each test.
- Add real decoded-frame and context-ownership regression coverage; preserve the camera/model assertions.
- Bound concurrent unit-test files at four without changing their assertions or timeouts.
- Commit Ink Lab's latest preview after 16ms if Chrome withholds the next frame; cancel both schedules on
  navigation/reset and reject stale callbacks. Preserve its existing 100ms browser assertion and add a
  real SVG regression with frame delivery deliberately withheld.

The ghost fan-out/deploy automation remains disabled by default. Hosted activation belongs to t-1611.
