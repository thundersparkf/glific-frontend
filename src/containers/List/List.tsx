import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, DocumentNode, useLazyQuery } from '@apollo/client';
import { IconButton, TableFooter, TablePagination, TableRow, Typography } from '@mui/material';

import { ListCard } from 'containers/List/ListCard/ListCard';
import { Button } from 'components/UI/Form/Button/Button';
import { Loading } from 'components/UI/Layout/Loading/Loading';
import { Pager } from 'components/UI/Pager/Pager';
import { DialogBox } from 'components/UI/DialogBox/DialogBox';
import { SearchBar } from 'components/UI/SearchBar/SearchBar';
import { Tooltip } from 'components/UI/Tooltip/Tooltip';
import DeleteIcon from 'assets/images/icons/Delete/Red.svg?react';
import EditIcon from 'assets/images/icons/Edit.svg?react';
import CrossIcon from 'assets/images/icons/Cross.svg?react';
import BackIcon from 'assets/images/icons/Back.svg?react';
import { GET_CURRENT_USER } from 'graphql/queries/User';
import { getUserRole, getUserRolePermissions } from 'context/role';
import { setNotification, setErrorMessage } from 'common/notification';
import { getUpdatedList, setListSession, getLastListSessionValues } from 'services/ListService';
import styles from './List.module.css';
import Track from 'services/TrackService';

export interface ColumnNames {
  name?: string;
  label: string;
  sort?: boolean;
  order?: string;
}

export interface ListProps {
  columnNames?: Array<ColumnNames>;
  countQuery: DocumentNode;
  listItem: string;
  filterItemsQuery: DocumentNode;
  deleteItemQuery: DocumentNode | null;
  listItemName: string;
  dialogMessage?: string | any;
  pageLink: string;
  columns: Function;
  listIcon: React.ReactNode;
  columnStyles: Array<any>;
  secondaryButton?: any;
  title: string;
  button?: {
    show: boolean;
    label?: string;
    link?: string;
    action?: Function;
    symbol?: string;
  };
  searchParameter?: Array<any>;
  filters?: Object | null;
  filterList?: any;
  filterDropdowm?: any;
  displayListType?: string;
  cardLink?: Object | null;
  editSupport?: boolean;
  additionalAction?: (listValues: any) => Array<{
    icon: any;
    parameter: string;
    link?: string;
    dialog?: any;
    label?: string;
    button?: any;
  }>;
  deleteModifier?: {
    icon: string;
    variables: any;
    label?: string;
  };
  dialogTitle?: string;
  backLinkButton?: {
    text: string;
    link: string;
  };
  restrictedAction?: any;
  collapseOpen?: boolean;
  collapseRow?: string;
  defaultSortBy?: string | null;
  noItemText?: string | null;
  customStyles?: any;
  refreshList?: boolean;
}

interface TableVals {
  pageNum: number;
  pageRows: number;
  sortCol: string;
  sortDirection: 'asc' | 'desc';
}

export const List = ({
  columnNames = [],
  countQuery,
  listItem,
  listIcon,
  filterItemsQuery,
  deleteItemQuery,
  listItemName,
  dialogMessage = '',
  secondaryButton,
  pageLink,
  columns,
  columnStyles,
  title,
  dialogTitle,
  filterList,
  filterDropdowm = null,
  button = {
    show: true,
    label: 'Add New',
  },
  deleteModifier = { icon: 'normal', variables: null, label: 'Delete' },
  editSupport = true,
  searchParameter = ['label'],
  filters = null,
  refreshList = false,
  displayListType = 'list',
  cardLink = null,
  additionalAction = () => [],
  backLinkButton,
  restrictedAction,
  collapseOpen = false,
  collapseRow = undefined,
  noItemText = null,
  customStyles,
}: ListProps) => {
  const { t } = useTranslation();

  // DialogBox states
  const [deleteItemID, setDeleteItemID] = useState<number | null>(null);
  const [deleteItemName, setDeleteItemName] = useState<string>('');
  const [newItem, setNewItem] = useState(false);

  const [searchParams, setSearchParams] = useSearchParams();

  // pick the search value from url if present
  const [searchVal, setSearchVal] = useState(new URLSearchParams(searchParams).get('search') || '');

  // check if the user has access to manage collections
  const userRolePermissions = getUserRolePermissions();
  const capitalListItemName = listItemName
    ? listItemName[0].toUpperCase() + listItemName.slice(1)
    : '';

  // function to get the default sorting set for columns
  const getDefaultSortColumn = (columnsFields: any) => {
    const sortColumn = columnsFields.find((field: any) => (field.sort ? field : ''));
    if (sortColumn) {
      return [sortColumn.name, sortColumn.order];
    }

    // if nothing is set assume first column is for sorting and order is 'asc'
    return [columnNames[0].name, 'asc'];
  };

  const [defaultColumnSort, defaultColumnSortOrder] = getDefaultSortColumn(columnNames);

  // get the last sort column value from local storage if exist else set the default column
  const getSortColumn = (listItemNameValue: string) => {
    // set the column name
    let columnnNameValue = defaultColumnSort;

    // check if we have sorting stored in local storage
    const sortValue = getLastListSessionValues(listItemNameValue, false);

    // update column name from the local storage
    if (sortValue) {
      columnnNameValue = sortValue;
    }

    return columnnNameValue;
  };

  // get the last sort direction value from local storage if exist else set the default order
  const getSortDirection = (listItemNameValue: string) => {
    let sortDirection = defaultColumnSortOrder;

    // check if we have sorting stored in local storage
    const sortValue = getLastListSessionValues(listItemNameValue, true);
    if (sortValue) {
      sortDirection = sortValue;
    }

    return sortDirection;
  };

  // Table attributes
  const [tableVals, setTableVals] = useState<TableVals>({
    pageNum: 0,
    pageRows: 50,
    sortCol: getSortColumn(listItemName),
    sortDirection: getSortDirection(listItemName),
  });

  let userRole: any = getUserRole();

  const handleTableChange = (attribute: string, newVal: any) => {
    const isSortAttribute = attribute === 'sortCol' || attribute === 'sortDirection';
    if (isSortAttribute) {
      const updatedList = getUpdatedList(listItemName, newVal, attribute === 'sortDirection');
      setListSession(JSON.stringify(updatedList));
    }

    setTableVals({
      ...tableVals,
      [attribute]: newVal,
    });
  };

  let filter: any = {};

  if (searchVal !== '') {
    searchParameter.forEach((parameter: string) => {
      filter[parameter] = searchVal;
    });
  }
  filter = {
    ...filter,
    ...filters,
  };

  const filterPayload = useCallback(() => {
    let order = 'ASC';
    if (tableVals.sortDirection) {
      order = tableVals.sortDirection.toUpperCase();
    }
    return {
      filter,
      opts: {
        limit: tableVals.pageRows,
        offset: tableVals.pageNum * tableVals.pageRows,
        order,
        orderWith: tableVals.sortCol,
      },
    };
  }, [searchVal, tableVals, filters]);

  // Get the total number of items here
  const {
    loading: l,
    error: e,
    data: countData,
    refetch: refetchCount,
  } = useQuery(countQuery, {
    variables: { filter },
  });

  // Get item data here
  const [fetchQuery, { loading, error, data, refetch: refetchValues }] = useLazyQuery(
    filterItemsQuery,
    {
      variables: filterPayload(),
      fetchPolicy: 'cache-first',
    }
  );

  // Get item data here
  const [fetchUserCollections, { loading: loadingCollections, data: userCollections }] =
    useLazyQuery(GET_CURRENT_USER);

  const checkUserRole = () => {
    userRole = getUserRole();
  };

  useEffect(() => {
    refetchValues();
    refetchCount();
  }, [searchVal, filters, refreshList]);

  useEffect(() => {
    if (userRole.length === 0) {
      checkUserRole();
    } else {
      if (!userRolePermissions.manageCollections && listItem === 'collections') {
        // if user role staff then display collections related to login user
        fetchUserCollections();
      }
      fetchQuery();
      Track(`Visit ${listItemName}`);
    }
  }, []);

  let deleteItem: any;

  // Make a new count request for a new count of the # of rows from this query in the back-end.
  if (deleteItemQuery) {
    [deleteItem] = useMutation(deleteItemQuery, {
      onCompleted: () => {
        setNotification(`${capitalListItemName} deleted successfully`);
        checkUserRole();
        refetchCount();
        if (refetchValues) {
          refetchValues(filterPayload());
        }
      },
      onError: () => {
        setNotification(`Sorry! An error occurred!`, 'warning');
      },
    });
  }

  const showDialogHandler = (id: any, label: string) => {
    setDeleteItemName(label);
    setDeleteItemID(id);
  };

  const closeDialogBox = () => {
    setDeleteItemID(null);
  };

  const deleteHandler = (id: number) => {
    const variables = deleteModifier.variables ? deleteModifier.variables(id) : { id };
    deleteItem({ variables });
  };

  const handleDeleteItem = () => {
    if (deleteItemID !== null) {
      deleteHandler(deleteItemID);
    }
    setDeleteItemID(null);
  };

  const useDelete = (message: string | any) => {
    if (typeof message === 'string') {
      const props = { handleOk: handleDeleteItem };
      return {
        component: message,
        props,
      };
    } else {
      /**
       * Custom component to render
       * message should contain 3 params
       * 1. component: Component to render
       * 2. props: props to pass to dialog component
       */

      const dialogParams = {
        deleteItemID,
        deleteItemName,
        refetch: refetchValues,
        setDeleteItemID,
      };
      const { component, props } = message(dialogParams);
      if (!props.handleOk) {
        props.handleOk = handleDeleteItem;
      }
      return {
        component,
        props,
      };
    }
  };

  let dialogBox;
  if (deleteItemID) {
    const { component, props } = useDelete(dialogMessage);
    dialogBox = (
      <DialogBox
        title={
          dialogTitle || `Are you sure you want to delete the ${listItemName} "${deleteItemName}"?`
        }
        handleCancel={closeDialogBox}
        colorOk="warning"
        alignButtons="center"
        {...props}
      >
        <div className={styles.DialogText}>
          <div>{component}</div>
        </div>
      </DialogBox>
    );
  }

  if (newItem) {
    return <Navigate to={`/${pageLink}/add`} />;
  }

  if (loading || l || loadingCollections) return <Loading />;
  if (error || e) {
    if (error) {
      setErrorMessage(error);
    } else if (e) {
      setErrorMessage(e);
    }
    return null;
  }

  // Reformat all items to be entered in table
  function getIcons(
    // id: number | undefined,
    item: any,
    allowedAction: any | null
  ) {
    // there might be a case when we might want to allow certain actions for reserved items
    // currently we don't allow edit or delete for reserved items. hence return early
    const { id, label, name, isReserved } = item;

    let labelValue = label;

    if (name) {
      labelValue = name;
    }

    if (isReserved) {
      return null;
    }
    let editButton = null;
    if (editSupport) {
      editButton = allowedAction.edit && (
        <Link to={`/${pageLink}/${id}/edit`}>
          <IconButton aria-label={t('Edit')} data-testid="EditIcon">
            <Tooltip title={t('Edit')} placement="top">
              <EditIcon />
            </Tooltip>
          </IconButton>
        </Link>
      );
    }

    const deleteButton = (Id: any, text: string) =>
      allowedAction.delete ? (
        <IconButton
          aria-label={t('Delete')}
          data-testid="DeleteIcon"
          onClick={() => showDialogHandler(Id, text)}
        >
          <Tooltip title={`${deleteModifier.label}`} placement="top">
            {deleteModifier.icon === 'cross' ? <CrossIcon /> : <DeleteIcon />}
          </Tooltip>
        </IconButton>
      ) : null;
    if (id) {
      return (
        <div className={styles.Icons}>
          {additionalAction(item).map((action: any, index: number) => {
            if (allowedAction.restricted) {
              return null;
            }
            // check if we are dealing with nested element
            let additionalActionParameter: any;
            const params: any = action.parameter.split('.');
            if (params.length > 1) {
              additionalActionParameter = item[params[0]][params[1]];
            } else {
              additionalActionParameter = item[params[0]];
            }
            const key = index;

            if (action.link) {
              return (
                <Link to={`${action.link}/${additionalActionParameter}`} key={key}>
                  <IconButton className={styles.additonalButton} data-testid="additionalButton">
                    <Tooltip title={`${action.label}`} placement="top">
                      {action.icon}
                    </Tooltip>
                  </IconButton>
                </Link>
              );
            }
            if (action.dialog) {
              return (
                <IconButton
                  data-testid="additionalButton"
                  className={styles.additonalButton}
                  id="additionalButton-icon"
                  onClick={() => action.dialog(additionalActionParameter, item)}
                  key={key}
                >
                  <Tooltip title={`${action.label}`} placement="top" key={key}>
                    {action.icon}
                  </Tooltip>
                </IconButton>
              );
            }
            if (action.button) {
              return action.button(item, action, key, fetchQuery);
            }
            return null;
          })}

          {/* do not display edit & delete for staff role in collection */}
          {userRolePermissions.manageCollections || item !== 'collections' ? (
            <>
              {editButton}
              {deleteButton(id, labelValue)}
            </>
          ) : null}
        </div>
      );
    }
    return null;
  }

  function formatList(listItems: Array<any>) {
    return listItems.map(({ ...listItemObj }) => {
      // display only actions allowed to the user
      const allowedAction = restrictedAction
        ? restrictedAction(listItemObj)
        : { chat: true, edit: true, delete: true };
      return {
        ...columns(listItemObj),
        operations: getIcons(listItemObj, allowedAction),
        recordId: listItemObj.id,
        isActive: listItemObj.isActive,
      };
    });
  }

  const resetTableVals = () => {
    setTableVals({
      pageNum: 0,
      pageRows: 50,
      sortCol: getSortColumn(listItemName),
      sortDirection: getSortDirection(listItemName),
    });
  };

  const handleSearch = (searchError: any) => {
    searchError.preventDefault();
    const searchValInput = searchError.target.querySelector('input').value.trim();

    setSearchParams({
      search: searchValInput,
    });
    setSearchVal(searchValInput);
    resetTableVals();
  };

  // Get item data and total number of items.
  let itemList: any = [];
  if (data) {
    itemList = formatList(data[listItem]);
  }

  if (userCollections) {
    if (listItem === 'collections') {
      itemList = formatList(userCollections.currentUser.user.groups);
    }
  }

  let itemCount: number = tableVals.pageRows;
  if (countData) {
    itemCount = countData[`count${listItem[0].toUpperCase()}${listItem.slice(1)}`];
  }
  let displayList;
  if (displayListType === 'list') {
    displayList = (
      <Pager
        columnStyles={columnStyles}
        columnNames={columnNames}
        data={itemList}
        totalRows={itemCount}
        handleTableChange={handleTableChange}
        tableVals={tableVals}
        collapseOpen={collapseOpen}
        collapseRow={collapseRow}
      />
    );
  } else if (displayListType === 'card') {
    /* istanbul ignore next */
    displayList = (
      <>
        <ListCard data={itemList} link={cardLink} />
        <table>
          <TableFooter className={styles.TableFooter} data-testid="tableFooter">
            <TableRow>
              <TablePagination
                className={styles.FooterRow}
                colSpan={columnNames.length}
                count={itemCount}
                onPageChange={(event, newPage) => {
                  handleTableChange('pageNum', newPage);
                }}
                onRowsPerPageChange={(event) => {
                  handleTableChange('pageRows', parseInt(event.target.value, 10));
                }}
                page={tableVals.pageNum}
                rowsPerPage={tableVals.pageRows}
                rowsPerPageOptions={[50, 75, 100, 150, 200]}
              />
            </TableRow>
          </TableFooter>
        </table>
      </>
    );
  }

  const backLink = backLinkButton ? (
    <div className={styles.BackLink}>
      <Link to={backLinkButton.link}>
        <BackIcon />
        {backLinkButton.text}
      </Link>
    </div>
  ) : null;

  let buttonDisplay;
  if (button.show) {
    let buttonContent;
    if (button.action) {
      buttonContent = (
        <Button
          color="primary"
          variant="contained"
          onClick={() => button.action && button.action()}
        >
          {button.symbol} {button.label}
        </Button>
      );
    } else if (!button.link) {
      buttonContent = (
        <Button
          color="primary"
          variant="contained"
          onClick={() => setNewItem(true)}
          data-testid="newItemButton"
        >
          {button.symbol} {button.label}
        </Button>
      );
    } else {
      buttonContent = (
        <Link to={button.link}>
          <Button color="primary" variant="contained" data-testid="newItemLink">
            {button.symbol} {button.label}
          </Button>
        </Link>
      );
    }
    buttonDisplay = <div className={styles.AddButton}>{buttonContent}</div>;
  }

  const noItemsText = (
    <div className={styles.NoResults}>
      {searchVal ? (
        <div>{t('Sorry, no results found! Please try a different search.')}</div>
      ) : (
        <div>
          There are no {noItemText || listItemName}s right now.{' '}
          {button.show && t('Please create one.')}
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className={styles.Header} data-testid="listHeader">
        <Typography variant="h5" className={styles.Title}>
          <IconButton disabled className={styles.Icon}>
            {listIcon}
          </IconButton>
          {title}
        </Typography>
        <div>
          {dialogBox}
          <div className={styles.ButtonGroup}>
            {buttonDisplay}
            {secondaryButton}
          </div>
        </div>
      </div>

      <div className={styles.FilterFields}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {filterList}
          {filterDropdowm}
        </div>
        <div className={styles.Buttons}>
          <SearchBar
            handleSubmit={handleSearch}
            onReset={() => {
              setSearchParams({ search: '' });
              setSearchVal('');
              resetTableVals();
            }}
            searchVal={searchVal}
            handleChange={(err: any) => {
              // reset value only if empty
              if (!err.target.value) setSearchVal('');
            }}
            searchMode
          />
        </div>
      </div>
      <div className={`${styles.Body} ${customStyles}`}>
        {backLink}
        {/* Rendering list of items */}
        {itemList.length > 0 ? displayList : noItemsText}
      </div>
    </>
  );
};
