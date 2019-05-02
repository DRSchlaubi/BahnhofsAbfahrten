import { CommonState } from 'AppState';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router-dom';
import ActionHome from '@material-ui/icons/Home';
import IconButton from '@material-ui/core/IconButton';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import React, { SyntheticEvent, useCallback, useState } from 'react';

type StateProps = {
  routingFeature: boolean;
};
type Props = StateProps & RouteComponentProps;

const HomeMenu = ({ history, routingFeature }: Props) => {
  const [anchor, setAnchor] = useState<undefined | HTMLElement>(undefined);

  const toggleMenu = useCallback(
    (e: SyntheticEvent<HTMLElement>) =>
      setAnchor(anchor ? undefined : e.currentTarget),
    [anchor]
  );
  const toAbfahrten = useCallback(
    (e: SyntheticEvent<HTMLElement>) => {
      history.push('/');
      toggleMenu(e);
    },
    [history, toggleMenu]
  );
  const toRouting = useCallback(
    (e: SyntheticEvent<HTMLElement>) => {
      history.push('/routing');
      toggleMenu(e);
    },
    [history, toggleMenu]
  );

  return (
    <>
      <IconButton
        aria-label="Home"
        onClick={routingFeature ? toggleMenu : toAbfahrten}
        color="inherit"
      >
        <ActionHome color="inherit" />
      </IconButton>
      {routingFeature && (
        <Menu open={Boolean(anchor)} anchorEl={anchor} onClose={toggleMenu}>
          <MenuItem onClick={toAbfahrten}>Abfahrten</MenuItem>
          <MenuItem onClick={toRouting}>Routing (WIP)</MenuItem>
        </Menu>
      )}
    </>
  );
};

export default connect<StateProps, {}, {}, CommonState>(state => ({
  routingFeature: state.features.routing,
}))(withRouter(HomeMenu));
