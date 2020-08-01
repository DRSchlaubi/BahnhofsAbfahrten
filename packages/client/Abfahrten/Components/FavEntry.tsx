import { AbfahrtenConfigContainer } from 'client/Abfahrten/container/AbfahrtenConfigContainer';
import { Delete } from '@material-ui/icons';
import { IconButton, Paper } from '@material-ui/core';
import { Link } from 'react-router-dom';
import { useCallback } from 'react';
import { useUnfav } from 'client/Abfahrten/container/FavContainer';
import styled, { css } from 'styled-components';
import type { MouseEvent, ReactNode } from 'react';
import type { Station } from 'types/station';

const Wrap = styled(Paper)<{ $clickable?: boolean }>`
  min-height: 48px;
  margin-bottom: 1px;
  flex-shrink: 0;
  padding: 0 0.5em;
  font-size: 1.6em;
  color: ${({ theme }) => theme.palette.text.primary};
  display: flex;
  align-items: center;
  ${({ theme }) => theme.breakpoints.up('sm')} {
    font-size: 2rem;
  }
  > a {
    color: ${({ theme }) => theme.palette.text.primary};
  }
  ${({ $clickable }) =>
    $clickable
      ? css`
          :hover {
            background-color: ${({ theme }) => theme.palette.action.hover};
          }
          justify-content: space-between;
        `
      : css`
          font-weight: 600;
          justify-content: center;
        `}
`;

interface Props {
  fav: Station;
  noDelete?: boolean;
  'data-testid'?: string;
}

interface FavEntryDisplayProps {
  deleteFav?: (e: MouseEvent) => void;
  text: ReactNode;
  'data-testid'?: string;
  clickable?: boolean;
}
export const FavEntryDisplay = ({
  deleteFav,
  text,
  clickable = true,
  'data-testid': testid,
}: FavEntryDisplayProps) => (
  <Wrap data-testid={testid} $clickable={clickable} square>
    <span>{text}</span>
    {deleteFav && (
      <IconButton
        data-testid="deleteFav"
        aria-label={`${text} entfernen`}
        onClick={deleteFav}
        color="inherit"
      >
        <Delete />
      </IconButton>
    )}
  </Wrap>
);

export const FavEntry = ({
  fav,
  noDelete,
  'data-testid': testid = 'favEntry',
}: Props) => {
  const { urlPrefix } = AbfahrtenConfigContainer.useContainer();
  const unfav = useUnfav();
  const deleteFav = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      unfav(fav);
    },
    [fav, unfav]
  );

  return (
    <Link
      data-testid={testid}
      to={`${urlPrefix}${encodeURIComponent(fav.title)}`}
      title={`Zugabfahrten für ${fav.title}`}
    >
      <FavEntryDisplay
        text={fav.title}
        deleteFav={noDelete ? undefined : deleteFav}
      />
    </Link>
  );
};
