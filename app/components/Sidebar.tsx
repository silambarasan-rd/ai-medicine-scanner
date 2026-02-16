'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faHouse, 
  faRobot, 
  faSyringe, 
  faCapsules, 
  faHospital, 
  faUser,
  faChevronDown,
  faChevronRight,
  faList,
  faPlus,
  faCalendar,
  faClockRotateLeft,
  faXmark
} from '@fortawesome/free-solid-svg-icons';
import styles from './Sidebar.module.css';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
    medication: false,
    pharmacy: false,
  });

  // Don't show sidebar on login page
  if (pathname === '/login') {
    return null;
  }

  const toggleMenu = (menuKey: string) => {
    setExpandedMenus(prev => ({
      ...prev,
      [menuKey]: !prev[menuKey]
    }));
  };

  const isActive = (href: string) => pathname === href;
  const isParentActive = (paths: string[]) => paths.some(path => pathname.startsWith(path));

  const medicationPaths = ['/medication', '/add-medicine', '/calendar'];
  const pharmacyPaths = ['/digital-pharmacy'];

  const handleLinkClick = () => {
    if (window.innerWidth < 1024) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className={styles.overlay}
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        {/* Mobile Header */}
        <div className={styles.mobileHeader}>
          <h2 className={styles.sidebarTitle}>Navigation</h2>
          <button
            onClick={onToggle}
            className={styles.closeBtn}
            aria-label="Close sidebar"
          >
            <FontAwesomeIcon icon={faXmark} />
          </button>
        </div>

        <nav className={styles.nav}>
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={`${styles.navItem} ${isActive('/dashboard') ? styles.active : ''}`}
            onClick={handleLinkClick}
          >
            <FontAwesomeIcon icon={faHouse} className={styles.icon} />
            <span>Dashboard</span>
          </Link>

          {/* AI Assistant */}
          <Link
            href="/chatbot"
            className={`${styles.navItem} ${isActive('/chatbot') ? styles.active : ''}`}
            onClick={handleLinkClick}
          >
            <FontAwesomeIcon icon={faRobot} className={styles.icon} />
            <span>AI Assistant</span>
          </Link>

          {/* Medication (with submenu) */}
          <div className={styles.menuGroup}>
            <button
              onClick={() => toggleMenu('medication')}
              className={`${styles.navItem} ${styles.menuToggle} ${isParentActive(medicationPaths) ? styles.active : ''}`}
            >
              <div className={styles.menuLeft}>
                <FontAwesomeIcon icon={faSyringe} className={styles.icon} />
                <span>Medication</span>
              </div>
              <FontAwesomeIcon 
                icon={expandedMenus.medication ? faChevronDown : faChevronRight} 
                className={styles.chevron}
              />
            </button>
            
            {expandedMenus.medication && (
              <div className={styles.submenu}>
                <Link
                  href="/medication"
                  className={`${styles.submenuItem} ${isActive('/medication') ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <FontAwesomeIcon icon={faList} className={styles.submenuIcon} />
                  <span>My Medications</span>
                </Link>
                <Link
                  href="/add-medicine"
                  className={`${styles.submenuItem} ${isActive('/add-medicine') ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <FontAwesomeIcon icon={faPlus} className={styles.submenuIcon} />
                  <span>Add Medication</span>
                </Link>
                <Link
                  href="/calendar"
                  className={`${styles.submenuItem} ${isActive('/calendar') ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <FontAwesomeIcon icon={faCalendar} className={styles.submenuIcon} />
                  <span>Calendar</span>
                </Link>
              </div>
            )}
          </div>

          {/* Digital Pharmacy (with submenu) */}
          <div className={styles.menuGroup}>
            <button
              onClick={() => toggleMenu('pharmacy')}
              className={`${styles.navItem} ${styles.menuToggle} ${isParentActive(pharmacyPaths) ? styles.active : ''}`}
            >
              <div className={styles.menuLeft}>
                <FontAwesomeIcon icon={faCapsules} className={styles.icon} />
                <span>Digital Pharmacy</span>
              </div>
              <FontAwesomeIcon 
                icon={expandedMenus.pharmacy ? faChevronDown : faChevronRight} 
                className={styles.chevron}
              />
            </button>
            
            {expandedMenus.pharmacy && (
              <div className={styles.submenu}>
                <Link
                  href="/digital-pharmacy"
                  className={`${styles.submenuItem} ${isActive('/digital-pharmacy') ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <FontAwesomeIcon icon={faList} className={styles.submenuIcon} />
                  <span>Inventory</span>
                </Link>
                <Link
                  href="/digital-pharmacy/add"
                  className={`${styles.submenuItem} ${isActive('/digital-pharmacy/add') ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <FontAwesomeIcon icon={faPlus} className={styles.submenuIcon} />
                  <span>Add Medicine</span>
                </Link>
                <Link
                  href="/digital-pharmacy/history"
                  className={`${styles.submenuItem} ${isActive('/digital-pharmacy/history') ? styles.active : ''}`}
                  onClick={handleLinkClick}
                >
                  <FontAwesomeIcon icon={faClockRotateLeft} className={styles.submenuIcon} />
                  <span>Stock Movement</span>
                </Link>
              </div>
            )}
          </div>

          {/* Hospitals */}
          <Link
            href="/hospitals"
            className={`${styles.navItem} ${isActive('/hospitals') ? styles.active : ''}`}
            onClick={handleLinkClick}
          >
            <FontAwesomeIcon icon={faHospital} className={styles.icon} />
            <span>Hospitals</span>
          </Link>

          {/* Profile Settings */}
          <Link
            href="/profile"
            className={`${styles.navItem} ${isActive('/profile') ? styles.active : ''}`}
            onClick={handleLinkClick}
          >
            <FontAwesomeIcon icon={faUser} className={styles.icon} />
            <span>Profile Settings</span>
          </Link>
        </nav>
      </aside>
    </>
  );
}
