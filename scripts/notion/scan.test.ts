import { describe, expect, it } from 'vitest';

import { ipLabel, scanMarkdown } from './scan.ts';

const kinds = (md: string, kind: string) =>
  scanMarkdown(md)
    .filter((f) => f.kind === kind)
    .map((f) => `${f.line}:${f.match}`);

describe('flag', () => {
  it('báo flag chưa che, kể cả dạng đã escape và flag{…}', () => {
    const md = [
      'THM\\{fake\\_test\\_flag\\}',
      '`HTB{fake-test}`',
      'flag{fake}',
      'thm{fake-lower}',
    ].join('\n');
    expect(kinds(md, 'flag')).toEqual([
      '1:THM\\{fake\\_test\\_flag\\}',
      '2:HTB{fake-test}',
      '3:flag{fake}',
      '4:thm{fake-lower}',
    ]);
  });

  it('bỏ qua flag đã che hợp lệ (giống test:dist)', () => {
    const md = 'THM{REDACTED} HTB{<redacted>} THM\\{\\<redacted>\\} flag{ redacted }';
    expect(kinds(md, 'flag')).toEqual([]);
  });
});

describe('IPv4', () => {
  it('liệt kê mọi IP hợp lệ kèm nhãn, bỏ số ngoài 0–255 và chuỗi phiên bản dài', () => {
    const md = 'ssh 10.10.12.34 và 8.8.8.8\n256.1.1.1 1.2.3.4.5 v1.2.3\n192.0.2.7 127.0.0.1';
    const found = scanMarkdown(md).filter((f) => f.kind === 'ip');
    expect(found.map((f) => `${f.line}:${f.match}:${f.note}`)).toEqual([
      '1:10.10.12.34:riêng tư',
      '1:8.8.8.8:công khai',
      '3:192.0.2.7:tài liệu',
      '3:127.0.0.1:loopback',
    ]);
  });

  it('nhãn địa chỉ', () => {
    expect(ipLabel([172, 16, 0, 1])).toBe('riêng tư');
    expect(ipLabel([172, 32, 0, 1])).toBe('công khai');
    expect(ipLabel([100, 64, 1, 1])).toBe('CGNAT');
    expect(ipLabel([169, 254, 1, 1])).toBe('link-local');
  });
});

describe('user@host: MỌI nơi (báo thừa), không chỉ mẫu Kali/AWS', () => {
  it('trong code block, inline code và chữ thường (email); ghi chú "ngoài code"', () => {
    const md = [
      'chữ thường a@b.example và `root@my-laptop` và user\\_1@box',
      '```bash',
      'kali@kali:~$ id',
      'root@ip-10-10-1-1:/# whoami',
      '┌──(kali㉿kali)-[~]',
      'user1@home-pc:~/ctf$ ls',
      'git clone git@gitlab.com:x/y.git',
      '```',
    ].join('\n');
    const found = scanMarkdown(md).filter((f) => f.kind === 'prompt');
    expect(found.map((f) => `${f.line}:${f.match}:${f.note ?? 'code'}`)).toEqual([
      '1:a@b.example:ngoài code',
      '1:root@my-laptop:ngoài code',
      '1:user_1@box:ngoài code',
      '3:kali@kali:code',
      '4:root@ip-10-10-1-1:code',
      '5:kali㉿kali:code',
      '6:user1@home-pc:code',
      '7:git@gitlab.com:code',
    ]);
  });

  it('fence ~~~, fence dài, code trong trích dẫn/danh sách', () => {
    const md = [
      '~~~',
      'u@h1',
      '~~~',
      '````',
      '```',
      'u@h2',
      '````',
      '> ```',
      '> u@h3',
      '> ```',
      '  ```',
      '  u@h4',
      '  ```',
    ].join('\n');
    const inCode = scanMarkdown(md).filter((f) => f.kind === 'prompt' && !f.note);
    expect(inCode.map((f) => `${f.line}:${f.match}`)).toEqual([
      '2:u@h1',
      '6:u@h2',
      '9:u@h3',
      '12:u@h4',
    ]);
  });
});

describe('flag 32 hex và đường dẫn home', () => {
  it('chuỗi 32 hex (flag user.txt/root.txt HTB hoặc hash), không khớp chuỗi dài hơn', () => {
    const md = ['cat user.txt → 0123456789abcdef0123456789ABCDEF', 'id ' + 'a'.repeat(40)].join(
      '\n',
    );
    expect(kinds(md, 'flag')).toEqual(['1:0123456789abcdef0123456789ABCDEF']);
  });

  it('/home/<tên>, /Users/<tên>, C:\\Users\\<tên> (cả dạng đã escape trong chữ)', () => {
    const md = [
      '```',
      'cd /home/user1/ctf && ls /Users/someone/Desktop',
      'type C:\\Users\\pcname\\flag.txt',
      '```',
      'đường dẫn C:\\\\Users\\\\other trong chữ',
    ].join('\n');
    expect(kinds(md, 'path')).toEqual([
      '2:/home/user1',
      '2:/Users/someone',
      '3:C:\\Users\\pcname',
      '5:C:\\Users\\other',
    ]);
  });
});
