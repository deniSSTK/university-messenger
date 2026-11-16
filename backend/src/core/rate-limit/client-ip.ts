import { isIP, SocketAddress } from 'node:net';

function clientIpIdentity(address: string | undefined): string {
  const version = address ? isIP(address) : 0;

  if (!address || !version) {
    return 'ip:unknown';
  }

  if (version === 4) {
    return `ip:${address}`;
  }

  const ipv6 = new SocketAddress({ address, family: 'ipv6' }).address;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ipv6);

  if (mapped) {
    return `ip:${mapped[1]}`;
  }

  const [head, tail] = ipv6.split('::');
  const first = head ? head.split(':') : [];
  const last = tail ? tail.split(':') : [];
  const expanded =
    tail === undefined
      ? first
      : [
          ...first,
          ...Array<string>(8 - first.length - last.length).fill('0'),
          ...last,
        ];

  return `ip:${expanded.slice(0, 4).join(':')}::/64`;
}

export { clientIpIdentity };
