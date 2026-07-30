'use client';
import React from 'react';

interface EntityWorkspaceLayoutProps {
  children: React.ReactNode;
  drawer?: React.ReactNode; // The EntityDetailDrawer component (returns null when closed)
  drawerOpen: boolean;
}

/**
 * EntityWorkspaceLayout wraps the page content and positions the detail drawer
 * on the opposite side of the main sidebar.
 *
 * When drawer is open, the main content area shrinks to accommodate.
 * In RTL this means drawer on the left (opposite right sidebar).
 * In LTR this means drawer on the right (opposite left sidebar).
 */
export function EntityWorkspaceLayout({
  children,
  drawer,
  drawerOpen,
}: EntityWorkspaceLayoutProps) {
  return (
    <div className="min-h-full">
      {children}
      {drawer}
    </div>
  );
}
