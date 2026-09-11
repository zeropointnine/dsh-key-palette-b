/**
 * dsh-key-palette-b — host half.
 *
 * The whole feature lives in the browser half (./client.js): the Cmd+/
 * floating shortcut palette, the `keys.actions` extension registry, and the
 * durable per-user bindings. The host half exists only so the package mounts
 * as a regular loader entry; it contributes nothing.
 */
export const name = 'dsh-key-palette-b';

export const inject = [];

export function apply() {}
