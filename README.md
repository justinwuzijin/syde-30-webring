# syde 2030 webring

systems design engineering c/o 2030 network @ university of waterloo. 

built by [justin wu](https://justinzwu.com) and [leo zhang](https://leo-zhang.com) between march 5 - 19, 2026.


## run locally

```bash
npm install
npm run dev
```

or with bun:

```bash
bun install
bun run dev
```

## add your polaroid to your personal site

paste this anywhere in your site's html — replace `your-id` with your webring id (visible in the url on your profile page, e.g. `justin-wu`):

```html
<iframe
  src="https://syde30.vercel.app/embed/your-id"
  width="198"
  height="287"
  style="border:none;background:transparent;overflow:hidden"
  scrolling="no"
  allow="autoplay"
  loading="lazy"
></iframe>
```

the embed is your exact polaroid from the webring — same photo, same live video on hover, same name reveal. it updates automatically whenever you change your polaroid on the webring.

you can also find the pre-filled snippet with your id on your profile page (`/profile/your-id`) under the "embed your polaroid" section.
