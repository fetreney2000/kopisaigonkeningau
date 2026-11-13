import type { AnchorHTMLAttributes } from 'react';

/** Pautan hash yang konsisten (cth. href="/inventori" -> "#/inventori") */
export function Link({ href, ...rest }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return <a href={href.startsWith('#') ? href : `#${href}`} {...rest} />;
}
