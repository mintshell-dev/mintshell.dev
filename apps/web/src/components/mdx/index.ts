import AttackChain from './AttackChain.astro';
import Callout from './Callout.astro';

/**
 * Component dùng được trong MDX write-up mà không cần import (truyền qua `<Content components>`,
 * ADR 0012). Chỉ những tên trong đây được ánh xạ.
 */
export const mdxComponents = { AttackChain, Callout };
