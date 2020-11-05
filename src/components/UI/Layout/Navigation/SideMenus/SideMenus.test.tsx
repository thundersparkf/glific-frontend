import React from 'react';
import {  MemoryRouter } from 'react-router-dom';
import { mount } from 'enzyme';
import { wait } from '@testing-library/react';
import SideMenus from './SideMenus';
import { setUserRole } from '../../../../../context/role';
import { getCurrentUserQuery } from '../../../../../mocks/User';

const mocks = [getCurrentUserQuery];
describe('side menu testing', () => {
  const component = (
    <MemoryRouter>
      <SideMenus opened={false} />
    </MemoryRouter>
  );

  it('it should be initialized properly', async () => {
    setUserRole('Admin')
    const wrapper = mount(component);
    await wait();
    expect(wrapper).toBeTruthy();
  });
 

  
});
