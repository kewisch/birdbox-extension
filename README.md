Birdbox
=======

Birdbox allows you to organize your communication tools into Thunderbird's spaces toolbar.

Thunderbird's mission in cludes creating an interoperable and extensible open-source platform for
messaging and managing personal information. Birdbox devilvers on this promise by bridging the gap
to all the web communication mechanisms not supported by Thunderbird's core.

This add-on is an experiment driven by the community. Your contribution is more than welcome.


Development
-----------

This add-on uses a standard npm setup for developer tools. You can run the following:

```
npm run lint        # Run all the linters
npm run build       # Build the xpi/zip extension package
npm run clean       # Blow away the web-ext-artifacts directory
```

You can also load this add-on into Thunderbird temporarily by going to Tools &rarr; Developer Tools
&rarr; Debug Add-ons and loading `src/manifest.json`
